import { useEffect, useMemo, useState } from 'react';
import initialGroupData from './data/initialGroups.json';
import './App.css';

const LOCAL_STORAGE_KEY = 'flashcard_groups_v6_data';

const createGroupMap = (groupsArray) => {
  const map = {};
  groupsArray.forEach((group) => {
    map[group.id] = {
      ...group,
      cards: group.cards.map((card) => ({ ...card })),
    };
  });
  return map;
};

const cloneGroupMap = (groupsMap) =>
  Object.fromEntries(
    Object.entries(groupsMap).map(([id, group]) => [
      id,
      {
        ...group,
        cards: group.cards.map((card) => ({ ...card })),
      },
    ]),
  );

const deriveNextIds = (groupsMap, baseNextGroupId, baseNextCardId) => {
  let maxGroupId = (baseNextGroupId ?? 1) - 1;
  let maxCardId = (baseNextCardId ?? 1) - 1;

  Object.values(groupsMap).forEach((group) => {
    maxGroupId = Math.max(maxGroupId, group.id);
    group.cards.forEach((card) => {
      maxCardId = Math.max(maxCardId, card.id);
    });
  });

  return {
    nextGroupId: Math.max(maxGroupId + 1, baseNextGroupId ?? maxGroupId + 1),
    nextCardId: Math.max(maxCardId + 1, baseNextCardId ?? maxCardId + 1),
  };
};

const BASE_GROUPS = createGroupMap(initialGroupData.groups);
const { nextGroupId: BASE_NEXT_GROUP_ID, nextCardId: BASE_NEXT_CARD_ID } = deriveNextIds(
  BASE_GROUPS,
  initialGroupData.nextGroupId,
  initialGroupData.nextCardId,
);

const loadGroups = () => {
  const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (savedData) {
    try {
      const parsedGroups = JSON.parse(savedData);
      const groups = cloneGroupMap(parsedGroups);
      const { nextGroupId, nextCardId } = deriveNextIds(
        groups,
        BASE_NEXT_GROUP_ID,
        BASE_NEXT_CARD_ID,
      );
      return { groups, nextGroupId, nextCardId };
    } catch (e) {
      console.error('Failed to parse groups from localStorage:', e);
    }
  }
  const groups = cloneGroupMap(BASE_GROUPS);
  const { nextGroupId, nextCardId } = deriveNextIds(
    groups,
    BASE_NEXT_GROUP_ID,
    BASE_NEXT_CARD_ID,
  );
  return { groups, nextGroupId, nextCardId };
};

const AI_CARD_TEMPLATES = [
  {
    question: (topic, focus) =>
      `${topic}${focus ? `（${focus}）` : ''}の最も重要な定義は？`,
    answer: (topic, focus) =>
      `定義の整理:\n・概要: ${topic}の核となる意味を1文で説明\n・背景: なぜ重要かを把握\n・具体例: ${focus || '主要な場面'} に触れる`,
  },
  {
    question: (topic, focus, index) =>
      `${topic}を学ぶ上で押さえておきたいキーワード ${index} は？`,
    answer: (topic, focus) =>
      `覚えるキーワードのヒント:\n1. ${topic}の基礎語句\n2. ${focus || '関連領域'} の代表用語\n3. 説明できるようになる具体的なフレーズ`,
  },
  {
    question: (topic, focus) =>
      `${topic}${focus ? `（${focus}）` : ''}の代表的な事例・ユースケースは？`,
    answer: (topic, focus) =>
      `事例を語る際の構成:\n・状況: どこで${topic}が使われるか\n・課題: ${focus || '現場'} の課題や課題感\n・成果: 何が改善されるか`,
  },
  {
    question: (topic) => `${topic}に関するよくある誤解や落とし穴は？`,
    answer: (topic, focus) =>
      `誤解を避ける視点:\n・本質: ${topic}のゴールを再確認\n・比較: 似ている概念との差分を整理\n・実務: ${focus || '実践'}での注意点を具体化`,
  },
  {
    question: (topic, focus, index) =>
      `${topic}${focus ? `（${focus}）` : ''}の確認テスト: チェックポイント${index}とは？`,
    answer: (topic, focus) =>
      `即答できるように準備:\n・問いかけ: ${topic}をどう説明するか\n・視点: ${focus || '関連領域'}の観点を加える\n・まとめ: 30秒で言える解答を作る`,
  },
];

const createAiFlashcards = (topic, detail, count, startId) => {
  const trimmedTopic = topic.trim();
  const trimmedDetail = detail.trim();
  const templates = AI_CARD_TEMPLATES;

  return Array.from({ length: count }, (_, index) => {
    const template = templates[index % templates.length];
    return {
      id: startId + index,
      category: trimmedDetail ? `${trimmedTopic} / ${trimmedDetail}` : trimmedTopic,
      question: template.question(trimmedTopic, trimmedDetail, index + 1),
      answer: template.answer(trimmedTopic, trimmedDetail, index + 1),
      easyCount: 0,
    };
  });
};

const CardFace = ({ content, isFront, category, easyCount }) => (
  <div
    className={`flashcard-face ${isFront ? 'flashcard-face--front' : 'flashcard-face--back'}`}
    aria-label={isFront ? '問題面' : '答え面'}
  >
    <span className="flashcard-face__badge">{isFront ? '問題' : '答え'}</span>
    <p className="flashcard-face__category">{category || 'カテゴリー未設定'}</p>
    <p className="flashcard-face__content">{content}</p>
    {!isFront && (
      <span className="flashcard-face__meta">わかった回数: {easyCount}</span>
    )}
  </div>
);

function AddCardForm({ categories, onAddCard, onToggle }) {
  const [formData, setFormData] = useState({
    category:
      categories.length > 1
        ? categories.filter((c) => c !== '全て')[0] || ''
        : '',
    question: '',
    answer: '',
    newCategory: '',
  });
  const [formError, setFormError] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormError('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setFormError('');

    const categoryToUse =
      formData.newCategory.trim() || formData.category.trim();

    if (!formData.question.trim() || !formData.answer.trim() || !categoryToUse) {
      setFormError(
        '必須項目（問題、答え、カテゴリー）が入力されていません。カードを追加するには、これらの項目すべてが必要です。',
      );
      return;
    }

    onAddCard({
      category: categoryToUse,
      question: formData.question.trim(),
      answer: formData.answer.trim(),
    });

    setFormData((prev) => ({
      ...prev,
      question: '',
      answer: '',
      newCategory: '',
      category: categoryToUse,
    }));
  };

  const existingCategories = categories.filter((c) => c !== '全て');

  return (
    <div className="panel panel--floating add-card-form">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">カード編集</p>
          <h3 className="panel__title">カードを追加</h3>
        </div>
        <button className="button button--ghost" onClick={onToggle} type="button">
          閉じる
        </button>
      </div>
      <form className="form" onSubmit={handleSubmit}>
        <div className="form__field form__field--stack">
          <label className="form__label">カテゴリー</label>
          <select
            className="form__control"
            name="category"
            onChange={handleChange}
            value={formData.category}
            disabled={Boolean(formData.newCategory.trim())}
          >
            <option value="">--- 既存のカテゴリーを選択 ---</option>
            {existingCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <span className="form__hint">または新しいカテゴリー名を入力してください。</span>
          <input
            className="form__control"
            name="newCategory"
            onChange={handleChange}
            placeholder="新しいカテゴリー名"
            type="text"
            value={formData.newCategory}
          />
        </div>

        <div className="form__field">
          <label className="form__label" htmlFor="question">
            問題
          </label>
          <textarea
            className="form__control form__control--textarea"
            id="question"
            name="question"
            onChange={handleChange}
            placeholder="例: Reactの最新バージョンは？"
            required
            rows={3}
            value={formData.question}
          />
        </div>

        <div className="form__field">
          <label className="form__label" htmlFor="answer">
            答え
          </label>
          <textarea
            className="form__control form__control--textarea"
            id="answer"
            name="answer"
            onChange={handleChange}
            placeholder="例: React 18 / React 19"
            required
            rows={3}
            value={formData.answer}
          />
        </div>

        {formError && <p className="form__error">{formError}</p>}

        <button className="button button--primary button--block" type="submit">
          カードを追加
        </button>
      </form>
    </div>
  );
}

function AiFlashcardGenerator({
  groups,
  isGenerating,
  lastResult,
  error,
  onGenerate,
}) {
  const [mode, setMode] = useState('new');
  const [formData, setFormData] = useState({
    topic: '',
    detail: '',
    count: 5,
    targetGroupId: '',
    newGroupName: '',
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!formData.topic.trim()) {
      return;
    }

    const payload = {
      topic: formData.topic,
      detail: formData.detail,
      count: Number(formData.count),
      mode,
      targetGroupId: formData.targetGroupId,
      newGroupName: formData.newGroupName,
    };
    onGenerate(payload);
  };

  const existingGroupOptions = useMemo(
    () =>
      Object.values(groups).map((group) => ({
        id: group.id,
        name: group.name,
      })),
    [groups],
  );

  const suggestedGroupName =
    formData.newGroupName.trim() ||
    (formData.topic.trim() ? `${formData.topic.trim()} (AI生成)` : '');

  return (
    <section className="panel panel--ai">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">AIサポート</p>
          <h2 className="panel__title">AIでフラッシュカードを生成</h2>
        </div>
        <span className="badge badge--outline">プレビュー</span>
      </header>
      <p className="panel__description">
        トピックと追加情報を入力すると、AIが学習カードのたたき台を作成します。
        生成されたカードは後から自由に編集できます。
      </p>

      <form className="form ai-form" onSubmit={handleSubmit}>
        <div className="form__grid">
          <div className="form__field">
            <label className="form__label" htmlFor="ai-topic">
              トピック<span className="form__required">必須</span>
            </label>
            <input
              autoComplete="off"
              className="form__control"
              id="ai-topic"
              name="topic"
              onChange={handleChange}
              placeholder="例: React コンポーネント設計"
              required
              value={formData.topic}
            />
          </div>

          <div className="form__field">
            <label className="form__label" htmlFor="ai-detail">
              補足情報
            </label>
            <input
              autoComplete="off"
              className="form__control"
              id="ai-detail"
              name="detail"
              onChange={handleChange}
              placeholder="例: フック / 状態管理 / テスト"
              value={formData.detail}
            />
          </div>

          <div className="form__field">
            <label className="form__label" htmlFor="ai-count">
              作成枚数
            </label>
            <select
              className="form__control"
              id="ai-count"
              name="count"
              onChange={handleChange}
              value={formData.count}
            >
              <option value={3}>3 枚</option>
              <option value={5}>5 枚</option>
              <option value={8}>8 枚</option>
              <option value={10}>10 枚</option>
            </select>
          </div>
        </div>

        <fieldset className="form__fieldgroup">
          <legend className="form__label">追加先</legend>
          <div className="ai-target">
            <label className="ai-target__option">
              <input
                checked={mode === 'new'}
                name="ai-target"
                onChange={() => setMode('new')}
                type="radio"
              />
              <span>新しいグループを作成</span>
            </label>
            <label className="ai-target__option">
              <input
                checked={mode === 'existing'}
                name="ai-target"
                onChange={() => setMode('existing')}
                type="radio"
              />
              <span>既存グループに追加</span>
            </label>
          </div>

          {mode === 'new' ? (
            <div className="form__field">
          <label className="form__label" htmlFor="ai-new-group">
            グループ名
          </label>
          <input
            className="form__control"
            id="ai-new-group"
            name="newGroupName"
            onChange={handleChange}
            placeholder="例: React基礎 (AI生成)"
            value={formData.newGroupName}
          />
          <span className="form__hint">
            空欄の場合は「{suggestedGroupName || '新規グループ'}」として作成されます。
          </span>
        </div>
          ) : (
            <div className="form__field">
              <label className="form__label" htmlFor="ai-existing-group">
                グループを選択
              </label>
              <select
                className="form__control"
                id="ai-existing-group"
                name="targetGroupId"
                onChange={handleChange}
                required={mode === 'existing'}
                value={formData.targetGroupId}
              >
                <option value="">--- グループを選択 ---</option>
                {existingGroupOptions.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </fieldset>

        {error && <p className="form__error">{error}</p>}

        <button
          className="button button--primary button--block"
          disabled={isGenerating}
          type="submit"
        >
          {isGenerating ? '生成中...' : 'カードを生成'}
        </button>
      </form>

      <footer className="panel__footer">
        {lastResult ? (
          <div className="ai-result">
            <p className="ai-result__title">直近の生成結果</p>
            <p className="ai-result__meta">
              {lastResult.groupName} に {lastResult.cardCount} 枚追加しました。
            </p>
            <p className="ai-result__meta">
              トピック: {lastResult.topic}
              {lastResult.detail ? ` ｜ 補足: ${lastResult.detail}` : ''}
            </p>
          </div>
        ) : (
          <p className="panel__note">
            バックエンドを接続すると、実際のAIモデルによるカード生成が行えます。
          </p>
        )}
      </footer>
    </section>
  );
}

function StudyScreen({ group, setGroup, setScreen, nextCardId, setNextCardId }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('全て');
  const [showAddForm, setShowAddForm] = useState(false);

  const cards = group.cards;

  const categories = useMemo(() => {
    const all = cards.map((card) => card.category).filter(Boolean);
    return ['全て', ...new Set(all)].sort();
  }, [cards]);

  const filteredCards = useMemo(() => {
    if (selectedCategory === '全て') {
      return cards;
    }
    return cards.filter((card) => card.category === selectedCategory);
  }, [cards, selectedCategory]);

  const masteredCount = useMemo(
    () => cards.filter((card) => (card.easyCount || 0) > 0).length,
    [cards],
  );

  const totalEasyCount = useMemo(
    () => cards.reduce((accumulator, card) => accumulator + (card.easyCount || 0), 0),
    [cards],
  );

  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [selectedCategory, cards.length]);

  const displayCard = filteredCards[currentIndex];
  const currentFilteredIndex = filteredCards.length > 0 ? currentIndex : -1;

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const moveToNextCard = () => {
    setIsFlipped(false);
    if (filteredCards.length > 0) {
      setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % filteredCards.length);
      }, 120);
    }
  };

  const handleLearningAction = (action) => {
    if (!displayCard) return;

    if (action === 'easy') {
      const updatedCards = cards.map((card) =>
        card.id === displayCard.id
          ? { ...card, easyCount: (card.easyCount || 0) + 1 }
          : card,
      );
      setGroup({ ...group, cards: updatedCards });
    }

    moveToNextCard();
  };

  const handleAddCard = (newCardData) => {
    const newCard = {
      id: nextCardId,
      ...newCardData,
      easyCount: 0,
    };

    const updatedCards = [...cards, newCard];

    setGroup({ ...group, cards: updatedCards });
    setNextCardId((prevId) => prevId + 1);
    setShowAddForm(false);
    setSelectedCategory(newCard.category);
  };

  return (
    <div className="screen study-screen">
      <header className="screen__header">
        <button
          className="button button--ghost"
          onClick={() => setScreen('Home')}
          type="button"
        >
          ← グループ一覧へ
        </button>
        <div className="screen__heading">
          <p className="screen__eyebrow">学習モード</p>
          <h1 className="screen__title">{group.name}</h1>
        </div>
        <div className="screen__actions">
          <button
            className="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            type="button"
          >
            {showAddForm ? 'フォームを閉じる' : 'カードを追加'}
          </button>
        </div>
      </header>

      <div className="study-layout">
        <div className="study-layout__main">
          <section className="panel panel--subtle study-controls">
            <div className="study-controls__item">
              <span className="study-controls__label">カテゴリー</span>
              <select
                className="form__control form__control--condensed"
                onChange={(event) => setSelectedCategory(event.target.value)}
                value={selectedCategory}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="study-controls__item">
              <span className="study-controls__label">進捗</span>
              <span className="study-controls__value">
                {filteredCards.length > 0
                  ? `${currentFilteredIndex + 1} / ${filteredCards.length}`
                  : '0 / 0'}
              </span>
            </div>
            <div className="study-controls__item">
              <span className="study-controls__label">総カード数</span>
              <span className="study-controls__value">{cards.length}</span>
            </div>
          </section>

          {showAddForm && (
            <AddCardForm
              categories={categories}
              onAddCard={handleAddCard}
              onToggle={() => setShowAddForm(false)}
            />
          )}

          {filteredCards.length > 0 && displayCard ? (
            <>
              <div
                aria-live="polite"
                className="flashcard-stage"
                onClick={handleFlip}
                onKeyDown={(event) => {
                  if (event.key === ' ') {
                    event.preventDefault();
                    handleFlip();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div
                  className={`flashcard ${isFlipped ? 'flashcard--flipped' : ''}`}
                >
                  <CardFace
                    category={displayCard.category}
                    content={displayCard.question}
                    easyCount={displayCard.easyCount}
                    isFront
                  />
                  <CardFace
                    category={displayCard.category}
                    content={displayCard.answer}
                    easyCount={displayCard.easyCount}
                    isFront={false}
                  />
                </div>
              </div>

              <div className="study-actions">
                {isFlipped ? (
                  <>
                    <button
                      className="button button--ghost"
                      onClick={() => handleLearningAction('hard')}
                      type="button"
                    >
                      もう一度 (Hard)
                    </button>
                    <button
                      className="button button--secondary"
                      onClick={() => handleLearningAction('easy')}
                      type="button"
                    >
                      わかった (Easy)
                    </button>
                  </>
                ) : (
                  <p className="study-hint">カードをクリックまたはスペースキーで反転</p>
                )}
              </div>
            </>
          ) : (
            <div className="panel panel--empty">
              <p>このカテゴリーにはカードがありません。</p>
              <p className="panel__note">カードを追加して学習を始めましょう。</p>
            </div>
          )}
        </div>

        <aside className="study-layout__aside">
          <section className="panel panel--floating study-summary">
            <header className="panel__header">
              <div>
                <p className="panel__eyebrow">セッション統計</p>
                <h2 className="panel__title">学習ダイジェスト</h2>
              </div>
            </header>
            <div className="metric-cards">
              <div className="metric-card">
                <span className="metric-card__label">マスター済み</span>
                <span className="metric-card__value">{masteredCount}</span>
                <span className="metric-card__hint">Easyを押したカード数</span>
              </div>
              <div className="metric-card">
                <span className="metric-card__label">総Easy回数</span>
                <span className="metric-card__value">{totalEasyCount}</span>
                <span className="metric-card__hint">理解した回数の累積</span>
              </div>
              <div className="metric-card">
                <span className="metric-card__label">残り</span>
                <span className="metric-card__value">
                  {Math.max(cards.length - masteredCount, 0)}
                </span>
                <span className="metric-card__hint">まだ理解度評価が必要</span>
              </div>
            </div>
          </section>

          <section className="panel panel--floating">
            <header className="panel__header">
              <div>
                <p className="panel__eyebrow">学習ヒント</p>
                <h2 className="panel__title">集中するポイント</h2>
              </div>
            </header>
            <ul className="bullet-list bullet-list--light">
              <li>Hardは同じカテゴリーのカードを連続で見直すタイミングに使いましょう。</li>
              <li>Easyを押したカードはセッション終了後に復習ログとして活用できます。</li>
              <li>カードが増えてきたらカテゴリーを分割して記憶を定着させましょう。</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function HomeScreen({
  groups,
  onCreateGroup,
  onDeleteGroup,
  onSelectGroup,
  nextGroupId,
  setNextGroupId,
  aiState,
  onGenerateAiCards,
}) {
  const groupList = Object.values(groups);
  const [newGroupName, setNewGroupName] = useState('');

  const totalCards = useMemo(
    () =>
      groupList.reduce((accumulator, current) => accumulator + current.cards.length, 0),
    [groupList],
  );

  const totalCategories = useMemo(() => {
    const categorySet = new Set();
    groupList.forEach((group) =>
      group.cards.forEach((card) => {
        if (card.category) categorySet.add(card.category);
      }),
    );
    return categorySet.size;
  }, [groupList]);

  const handleCreateGroup = (event) => {
    event.preventDefault();
    if (newGroupName.trim() === '') return;

    onCreateGroup(newGroupName.trim(), nextGroupId);
    setNextGroupId((prev) => prev + 1);
    setNewGroupName('');
  };

  const handleDeleteGroup = (groupId) => {
    onDeleteGroup(groupId);
  };

  const recentGroup = groupList[0] ?? null;

  return (
    <div className="screen home-screen">
      <header className="hero-panel hero-panel--simple">
        <div className="hero-panel__content">
          <span className="hero-panel__eyebrow">Study Multiple Flash</span>
          <h1 className="hero-panel__title">フラッシュカード学習ダッシュボード</h1>
          <p className="hero-panel__subtitle">
            作成・整理・学習・AI生成をシンプルなレイアウトにまとめました。ホワイトベースの落ち着いた画面で、学習に集中しましょう。
          </p>
          <div className="hero-panel__actions">
            <button
              className="button button--primary"
              onClick={() =>
                onGenerateAiCards({
                  topic: 'スターターテンプレート',
                  detail: 'UIチェック',
                  count: 3,
                  mode: 'new',
                  targetGroupId: '',
                  newGroupName: 'スタータースタック (AI)',
                })
              }
              type="button"
            >
              デモカードを生成
            </button>
            <button
              className="button button--secondary"
              disabled={!recentGroup}
              onClick={() => {
                if (recentGroup) {
                  onSelectGroup(recentGroup.id);
                }
              }}
              type="button"
            >
              直近のグループで学習
            </button>
          </div>
        </div>
        <div className="hero-panel__stats">
          <div className="stat stat--hero">
            <span className="stat__label">アクティブグループ</span>
            <span className="stat__value">{groupList.length}</span>
            <span className="stat__hint">AI生成も含む全グループ数</span>
          </div>
          <div className="hero-panel__stat-grid">
            <div className="stat">
              <span className="stat__label">カード</span>
              <span className="stat__value">{totalCards}</span>
              <span className="stat__hint">ローカルに保存されています</span>
            </div>
            <div className="stat">
              <span className="stat__label">カテゴリー</span>
              <span className="stat__value">{totalCategories}</span>
              <span className="stat__hint">重複を除いた一意の分類</span>
            </div>
          </div>
        </div>
      </header>

      <div className="home-grid">
        <AiFlashcardGenerator
          error={aiState.error}
          groups={groups}
          isGenerating={aiState.status === 'generating'}
          lastResult={aiState.lastResult}
          onGenerate={onGenerateAiCards}
        />

        <div className="home-grid__aside">
          <section className="panel panel--floating">
            <header className="panel__header">
              <div>
                <p className="panel__eyebrow">グループ管理</p>
                <h2 className="panel__title">新しいグループを作成</h2>
              </div>
            </header>
            <form className="form" onSubmit={handleCreateGroup}>
              <div className="form__field">
                <label className="form__label" htmlFor="new-group">
                  グループ名
                </label>
                <input
                  className="form__control"
                  id="new-group"
                  onChange={(event) => setNewGroupName(event.target.value)}
                  placeholder="例: 英単語テスト対策"
                  required
                  type="text"
                  value={newGroupName}
                />
              </div>
              <button className="button button--secondary button--block" type="submit">
                グループを作成
              </button>
            </form>
          </section>

          <section className="panel panel--floating">
            <header className="panel__header">
              <div>
                <p className="panel__eyebrow">クイックスタート</p>
                <h2 className="panel__title">使い方メモ</h2>
              </div>
            </header>
            <ul className="bullet-list">
              <li>AI生成でベースを作り、学習に合わせて調整しましょう。</li>
              <li>学習画面でカテゴリーを切り替えながら集中的に復習できます。</li>
              <li>Easyボタンで理解度を測り、進捗を蓄積できます。</li>
            </ul>
          </section>
        </div>
      </div>

      <section className="panel panel--collection">
        <header className="panel__header">
          <div>
            <p className="panel__eyebrow">グループ一覧</p>
            <h2 className="panel__title">
              マイグループ（{groupList.length} 件）
            </h2>
          </div>
        </header>

        {groupList.length === 0 ? (
          <div className="panel panel--empty">
            <p>まだグループがありません。</p>
            <p className="panel__note">
              グループを作成するか、AI生成でカードセットを用意してみましょう。
            </p>
          </div>
        ) : (
          <ul className="group-list">
            {groupList.map((group) => (
              <li className="group-card" key={group.id}>
                <div className="group-card__body">
                  <h3 className="group-card__title">{group.name}</h3>
                  <div className="group-card__meta">
                    <span className="badge">{group.cards.length} 枚</span>
                    <span className="badge badge--ghost">
                      {new Set(group.cards.map((card) => card.category || '未分類')).size} カテゴリー
                    </span>
                  </div>
                </div>
                <div className="group-card__actions">
                  <button
                    className="button button--secondary"
                    onClick={() => onSelectGroup(group.id)}
                    type="button"
                  >
                    学習開始
                  </button>
                  <button
                    className="button button--ghost"
                    onClick={() => handleDeleteGroup(group.id)}
                    type="button"
                  >
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function App() {
  const [{ groups, nextGroupId, nextCardId }, setAppState] = useState(loadGroups);
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [studyGroupId, setStudyGroupId] = useState(null);
  const [aiState, setAiState] = useState({
    status: 'idle',
    lastResult: null,
    error: '',
  });

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(groups));
  }, [groups]);

  const setNextGroupIdValue = (updater) => {
    setAppState((prev) => {
      const nextValue =
        typeof updater === 'function' ? updater(prev.nextGroupId) : updater;
      return { ...prev, nextGroupId: nextValue };
    });
  };

  const setNextCardIdValue = (updater) => {
    setAppState((prev) => {
      const nextValue =
        typeof updater === 'function' ? updater(prev.nextCardId) : updater;
      return { ...prev, nextCardId: nextValue };
    });
  };

  const updateGroupCards = (groupId, newGroupData) => {
    setAppState((prev) => ({
      ...prev,
      groups: {
        ...prev.groups,
        [groupId]: newGroupData,
      },
    }));
  };

  const handleCreateGroup = (groupName, id) => {
    const newGroup = {
      id,
      name: groupName,
      cards: [],
    };
    setAppState((prev) => ({
      ...prev,
      groups: { ...prev.groups, [id]: newGroup },
    }));
  };

  const handleDeleteGroup = (groupId) => {
    setAppState((prev) => {
      const newGroups = { ...prev.groups };
      delete newGroups[groupId];
      return { ...prev, groups: newGroups };
    });
  };

  const handleSelectGroup = (groupId) => {
    setStudyGroupId(groupId);
    setCurrentScreen('Study');
  };

  const handleGenerateAiCards = ({
    topic,
    detail,
    count,
    mode,
    targetGroupId,
    newGroupName,
  }) => {
    if (!topic.trim()) {
      setAiState({
        status: 'error',
        lastResult: null,
        error: 'トピックを入力してください。',
      });
      return;
    }

    if (mode === 'existing' && !targetGroupId) {
      setAiState({
        status: 'error',
        lastResult: null,
        error: '追加先のグループを選択してください。',
      });
      return;
    }

    setAiState((prev) => ({ ...prev, status: 'generating', error: '' }));

    const simulatedLatency = 700;
    setTimeout(() => {
      setAppState((prev) => {
        const cards = createAiFlashcards(topic, detail, count, prev.nextCardId);

        if (mode === 'existing') {
          const numericId = Number(targetGroupId);
          const targetGroup = prev.groups[numericId];

          if (!targetGroup) {
            setAiState({
              status: 'error',
              lastResult: null,
              error: '選択したグループが見つかりませんでした。',
            });
            return prev;
          }

          const updatedGroup = {
            ...targetGroup,
            cards: [...targetGroup.cards, ...cards],
          };

          setAiState({
            status: 'success',
            lastResult: {
              groupName: targetGroup.name,
              cardCount: cards.length,
              topic,
              detail,
            },
            error: '',
          });

          return {
            ...prev,
            groups: {
              ...prev.groups,
              [numericId]: updatedGroup,
            },
            nextCardId: prev.nextCardId + cards.length,
          };
        }

        const assignedGroupId = prev.nextGroupId;
        const resolvedName =
          newGroupName.trim() || `${topic.trim()} (AI生成)`;
        const newGroup = {
          id: assignedGroupId,
          name: resolvedName,
          cards,
        };

        setAiState({
          status: 'success',
          lastResult: {
            groupName: resolvedName,
            cardCount: cards.length,
            topic,
            detail,
          },
          error: '',
        });

        return {
          ...prev,
          groups: {
            ...prev.groups,
            [assignedGroupId]: newGroup,
          },
          nextGroupId: prev.nextGroupId + 1,
          nextCardId: prev.nextCardId + cards.length,
        };
      });
    }, simulatedLatency);
  };

  const currentGroup = studyGroupId ? groups[studyGroupId] : null;

  let content;

  if (currentScreen === 'Study' && currentGroup) {
    content = (
      <StudyScreen
        group={currentGroup}
        nextCardId={nextCardId}
        setGroup={(newGroupData) => updateGroupCards(studyGroupId, newGroupData)}
        setNextCardId={setNextCardIdValue}
        setScreen={setCurrentScreen}
      />
    );
  } else {
    if (currentScreen === 'Study' && !currentGroup) {
      console.warn(
        '学習中のグループデータが見つかりませんでした。ホーム画面に自動で戻ります。',
      );
      setCurrentScreen('Home');
    }

    content = (
      <HomeScreen
        aiState={aiState}
        groups={groups}
        nextGroupId={nextGroupId}
        onCreateGroup={handleCreateGroup}
        onDeleteGroup={handleDeleteGroup}
        onGenerateAiCards={handleGenerateAiCards}
        onSelectGroup={handleSelectGroup}
        setNextGroupId={setNextGroupIdValue}
      />
    );
  }

  return (
    <div className="app-shell">
      <div className="app-shell__backdrop" />
      <div className="app-shell__content">{content}</div>
    </div>
  );
}
