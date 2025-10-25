import React, { useState, useMemo, useEffect } from 'react';

// Firestoreの代わりにlocalStorageを使用
const LOCAL_STORAGE_KEY = 'flashcard_groups_v5_data';

// データの初期化: グループIDをキーとしたオブジェクト形式
const INITIAL_GROUPS = {
  1: {
    id: 1,
    name: '基礎知識 (例)',
    cards: [
      { id: 101, category: '日本の歴史', question: '江戸幕府を開いた人物は？', answer: '徳川家康', easyCount: 0 },
      { id: 102, category: 'プログラミング', question: 'Reactにおける状態管理フックの名前は？', answer: 'useState', easyCount: 0 },
    ],
  },
  2: {
    id: 2,
    name: '科学と地理 (例)',
    cards: [
      { id: 201, category: '地理', question: '世界の六大陸のうち、最も面積が広いのは？', answer: 'アジア大陸', easyCount: 0 },
      { id: 202, category: '科学', question: '酸素の元素記号は？', answer: 'O', easyCount: 0 },
    ],
  },
};

// localStorageからグループデータをロードする関数
const loadGroups = () => {
  const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (savedData) {
    try {
      const groups = JSON.parse(savedData);

      if (Object.keys(groups).length === 0) {
        return { groups: INITIAL_GROUPS, nextGroupId: 3, nextCardId: 203 };
      }

      const maxGroupId = Math.max(0, ...Object.keys(groups).map(Number));
      let maxCardId = 0;
      Object.values(groups).forEach(group => {
        group.cards.forEach(card => {
          maxCardId = Math.max(maxCardId, card.id);
        });
      });

      return { groups, nextGroupId: maxGroupId + 1, nextCardId: maxCardId + 1 };
    } catch (e) {
      console.error("Failed to parse groups from localStorage:", e);
      return { groups: INITIAL_GROUPS, nextGroupId: 3, nextCardId: 203 };
    }
  }
  return { groups: INITIAL_GROUPS, nextGroupId: 3, nextCardId: 203 };
};

// --- カード表示コンポーネント ---
const CardFace = ({ content, isFront, category, easyCount }) => (
  <div
    style={{ backfaceVisibility: 'hidden' }}
    // モノクロデザインの適用: ボーダーと影
    className={`absolute w-full h-full p-8 flex flex-col justify-center items-center text-center rounded-2xl shadow-xl transition-opacity duration-300 ease-in-out border-b-4 ${isFront
        ? 'bg-white border-gray-400'  // 問題: 薄いボーダー
        : 'bg-white border-gray-600'  // 答え: 濃いボーダー
      }`}
  >
    {/* モノクロデザインの適用: バッジの色 */}
    <div className={`absolute top-0 left-0 m-4 px-3 py-1 text-xs font-semibold rounded-lg ${isFront
        ? 'bg-gray-200 text-gray-700'
        : 'bg-gray-300 text-gray-800'
      }`}>
      {isFront ? '問題' : '答え'}
    </div>

    <p className="text-sm text-gray-500 mb-4 font-medium">{category}</p>

    <p className="text-xl md:text-3xl font-bold text-gray-800 leading-snug">
      {content}
    </p>

    {!isFront && (
      <p className="absolute bottom-4 right-4 text-xs text-gray-400">
        わかった回数: {easyCount}
      </p>
    )}
  </div>
);

// --- カード追加フォームコンポーネント ---
function AddCardForm({ categories, onAddCard, onToggle }) {
  const [formData, setFormData] = useState({
    category: categories.length > 1 ? categories.filter(c => c !== '全て')[0] || '' : '', // 初期値として既存カテゴリーの最初のものを選択
    question: '',
    answer: '',
    newCategory: '',
  });

  // 1. エラー状態の追加
  const [formError, setFormError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // ユーザーが入力し始めたらエラーをリセット
    setFormError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // 提出時にエラーをリセット
    setFormError('');

    // 修正: 優先度の決定 - newCategory (入力があれば) > category (選択されていれば)
    const categoryToUse = formData.newCategory.trim() || formData.category.trim();

    if (!formData.question.trim() || !formData.answer.trim() || !categoryToUse) {
      // 2. console.error を UI エラー表示に置き換え
      setFormError("必須項目（問題、答え、カテゴリー）が入力されていません。カードを追加するには、これらの項目すべてが必要です。");
      return;
    }

    onAddCard({
      category: categoryToUse,
      question: formData.question.trim(),
      answer: formData.answer.trim(),
    });

    setFormData(prev => ({
      ...prev,
      question: '',
      answer: '',
      newCategory: '',
      // 新しく追加したカテゴリーを維持するか、最初の既存カテゴリーに戻す
      category: categoryToUse // 修正後のカテゴリーを維持
    }));
  };

  const existingCategories = categories.filter(c => c !== '全て');

  return (
    <div className="p-6 mb-6 bg-white rounded-2xl shadow-xl border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800">カードの追加</h3>
        <button onClick={onToggle} className="text-gray-500 hover:text-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        {/* カテゴリー選択/新規入力 */}
        <div className="mb-4 space-y-3">
          <label className="block text-sm font-medium text-gray-700">カテゴリー</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            disabled={!!formData.newCategory.trim()}
            // モノクロデザインの適用: フォーカスリング
            className={`block w-full rounded-xl border-gray-300 shadow-sm p-3 text-gray-700 focus:ring-gray-700 focus:border-gray-700 text-base ${formData.newCategory.trim() ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          >
            <option value="">--- 既存のカテゴリーを選択 ---</option>
            {existingCategories.length > 0 && existingCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <p className="text-center text-gray-500 text-sm">または、新しいカテゴリーを作成</p>

          <input
            type="text"
            name="newCategory"
            value={formData.newCategory}
            onChange={handleChange}
            placeholder="新しいカテゴリー名を入力"
            // モノクロデザインの適用: フォーカスリング
            className="block w-full rounded-xl border-gray-300 shadow-sm p-3 focus:ring-gray-700 focus:border-gray-700 text-base"
          />
        </div>

        {/* 問題入力 */}
        <div className="mb-4">
          <label htmlFor="question" className="block text-sm font-medium text-gray-700">問題</label>
          <textarea
            id="question"
            name="question"
            value={formData.question}
            onChange={handleChange}
            required
            rows="2"
            // モノクロデザインの適用: フォーカスリング
            className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm p-3 focus:ring-gray-700 focus:border-gray-700 text-base"
            placeholder="例: Reactの最新バージョンは？"
          />
        </div>

        {/* 答え入力 */}
        <div className="mb-6">
          <label htmlFor="answer" className="block text-sm font-medium text-gray-700">答え</label>
          <textarea
            id="answer"
            name="answer"
            value={formData.answer}
            onChange={handleChange}
            required
            rows="2"
            // モノクロデザインの適用: フォーカスリング
            className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm p-3 focus:ring-gray-700 focus:border-gray-700 text-base"
            placeholder="例: React 18 / React 19"
          />
        </div>

        {/* 3. エラーメッセージの表示 */}
        {formError && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-xl text-sm font-medium">
            {formError}
          </div>
        )}

        {/* 送信ボタン */}
        <button
          type="submit"
          // モノクロデザインの適用: メインボタン (黒)
          className="w-full px-4 py-3 bg-gray-800 rounded-xl text-white font-semibold shadow-md hover:bg-gray-900 transition-colors"
        >
          カードを追加
        </button>
      </form>
    </div>
  );
}


// --- 学習画面コンポーネント ---
function StudyScreen({ group, setGroup, setScreen, nextCardId, setNextCardId }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('全て');
  const [showAddForm, setShowAddForm] = useState(false);

  const cards = group.cards;

  const categories = useMemo(() => {
    const all = cards.map(card => card.category).filter(Boolean);
    return ['全て', ...new Set(all)].sort();
  }, [cards]);

  const filteredCards = useMemo(() => {
    if (selectedCategory === '全て') {
      return cards;
    }
    return cards.filter(card => card.category === selectedCategory);
  }, [cards, selectedCategory]);

  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [selectedCategory, cards.length]);

  const displayCard = filteredCards[currentIndex];
  const currentFilteredIndex = filteredCards.length > 0 ? currentIndex : -1;

  // --- カード操作 ---
  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const moveToNextCard = () => {
    setIsFlipped(false);
    if (filteredCards.length > 0) {
      setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % filteredCards.length);
      }, 100);
    }
  };

  // --- 学習追跡機能 ---
  const handleLearningAction = (action) => {
    if (!displayCard) return;

    if (action === 'easy') {
      const updatedCards = cards.map(card =>
        card.id === displayCard.id ? { ...card, easyCount: (card.easyCount || 0) + 1 } : card
      );
      setGroup({ ...group, cards: updatedCards });
    }

    moveToNextCard();
  };

  // --- カード追加機能 ---
  const handleAddCard = (newCardData) => {
    const newCard = {
      id: nextCardId,
      ...newCardData,
      easyCount: 0,
    };

    const updatedCards = [...cards, newCard];

    setGroup({ ...group, cards: updatedCards });
    setNextCardId(prevId => prevId + 1);
    setShowAddForm(false);
    setSelectedCategory(newCard.category); // 新しく追加したカードのカテゴリーに自動で切り替える
  };


  return (
    <div className="w-full max-w-xl mx-auto">
      {/* ホームへ戻るボタンとタイトル */}
      <div className="flex justify-between items-center mb-8 p-4 bg-white rounded-2xl shadow-lg border border-gray-100">
        <button
          onClick={() => setScreen('Home')}
          className="flex items-center space-x-1 px-4 py-2 bg-gray-100 rounded-xl text-gray-700 font-semibold hover:bg-gray-200 transition-colors text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          <span>グループ一覧へ</span>
        </button>
        <h2 className="text-xl md:text-2xl font-extrabold text-gray-800">{group.name}</h2>
      </div>

      {/* --- カード追加ボタン --- */}
      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          // モノクロデザインの適用: メインボタン (黒)
          className="flex items-center space-x-2 px-4 py-2 bg-gray-800 rounded-xl text-white font-semibold shadow-md hover:bg-gray-900 transition-colors text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          <span>カードを追加</span>
        </button>
      </div>

      {/* --- カード追加フォーム --- */}
      {showAddForm && <AddCardForm categories={categories} onAddCard={handleAddCard} onToggle={() => setShowAddForm(false)} />}


      {/* --- カテゴリー選択ドロップダウン --- */}
      <div className="flex justify-between items-center mb-8 p-4 bg-white rounded-2xl shadow-md border border-gray-100">
        <label htmlFor="category-select" className="text-gray-700 font-medium mr-4">
          カテゴリー:
        </label>
        <select
          id="category-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          // モノクロデザインの適用: フォーカスリング
          className="p-2 border border-gray-300 rounded-xl shadow-sm focus:ring-gray-700 focus:border-gray-700 text-gray-700 bg-white"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* --- カードの表示とナビゲーション --- */}
      {filteredCards.length > 0 && displayCard ? (
        <>
          {/* --- 進捗表示 --- */}
          <div className="text-center text-gray-600 mb-6 font-medium">
            <p>
              {currentFilteredIndex + 1} / {filteredCards.length} 枚目 (全 {cards.length} 枚)
            </p>
          </div>

          {/* --- フラッシュカード本体 --- */}
          <div
            className="relative w-full h-80 perspective-1000 cursor-pointer mb-8"
            onClick={handleFlip}
            tabIndex="0"
            onKeyDown={(e) => {
              if (e.key === ' ') {
                e.preventDefault();
                handleFlip();
              }
            }}
          >
            {/* 3D反転コンテナ */}
            <div
              className="relative w-full h-full transition-transform duration-700 ease-in-out transform-gpu"
              style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
            >
              {/* カードの表面 (問題) */}
              <CardFace
                content={displayCard.question}
                isFront={true}
                category={displayCard.category}
                easyCount={displayCard.easyCount}
              />
              {/* カードの裏面 (答え) */}
              <div
                className="absolute w-full h-full transform rotate-y-180"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <CardFace
                  content={displayCard.answer}
                  isFront={false}
                  category={displayCard.category}
                  easyCount={displayCard.easyCount}
                />
              </div>
            </div>
          </div>

          {/* --- 学習追跡ボタン (裏返した後のみ表示) --- */}
          <div className="flex justify-center items-center space-x-4">
            {isFlipped ? (
              <>
                <button
                  onClick={() => handleLearningAction('hard')}
                  // モノクロデザインの適用: Hard (濃いグレー)
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-700 rounded-2xl text-white font-semibold shadow-lg hover:bg-gray-800 transition-all"
                >
                  <span>もう一度 (Hard)</span>
                </button>
                <button
                  onClick={() => handleLearningAction('easy')}
                  // モノクロデザインの適用: Easy (明るいグレー)
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-500 rounded-2xl text-white font-semibold shadow-lg hover:bg-gray-600 transition-all"
                >
                  <span>わかった (Easy)</span>
                </button>
              </>
            ) : (
              <p className="text-gray-500 font-medium p-3">カードをクリックして答えを表示</p>
            )}
          </div>

        </>
      ) : (
        <div className="text-center p-12 bg-white rounded-2xl shadow-xl border border-gray-100">
          <p className="text-lg font-medium text-gray-700">このカテゴリーにはカードがありません。</p>
          <p className="text-sm text-gray-500 mt-2">新しいカードを追加してください。</p>
        </div>
      )}

      {/* --- 操作説明 --- */}
      <p className="text-center text-sm text-gray-500 mt-6">
        (ヒント: カードをクリックするか、スペースキーを押すと反転します)
      </p>
    </div>
  );
}


// --- ホーム画面コンポーネント ---
function HomeScreen({ groups, onCreateGroup, onDeleteGroup, onSelectGroup, nextGroupId, setNextGroupId }) {
  const groupList = Object.values(groups);
  const [newGroupName, setNewGroupName] = useState('');

  const handleCreateGroup = (e) => {
    e.preventDefault();
    if (newGroupName.trim() === '') return;

    onCreateGroup(newGroupName.trim(), nextGroupId);
    setNextGroupId(nextGroupId + 1);
    setNewGroupName('');
  };

  const handleDeleteGroup = (groupId) => {
    // 規約に基づき、window.confirm()の代わりに、シンプルな処理に置き換えます。
    // ユーザーがボタンを押した時点で削除の意図があると見なします。
    onDeleteGroup(groupId);
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      {/* --- ダッシュボード風ヘッダー --- */}
      <div className="p-6 mb-8 bg-white rounded-2xl shadow-xl border border-gray-100">
        <h1 className="text-3xl font-extrabold text-gray-800">
          フラッシュカード 学習ダッシュボード
        </h1>
        <p className="text-lg text-gray-500 mt-1">作成済みのグループから学習を始めましょう。</p>
      </div>

      {/* --- 新規グループ作成フォーム --- */}
      <form onSubmit={handleCreateGroup} className="p-5 mb-8 bg-white rounded-2xl shadow-lg border border-gray-100">
        <h3 className="text-xl font-bold text-gray-800 mb-3 border-b pb-2">新しいグループを作成</h3>
        <div className="flex space-x-2 mt-4">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="グループ名を入力"
            // モノクロデザインの適用: フォーカスリング
            className="flex-grow p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-gray-700 focus:border-gray-700 text-base"
            required
          />
          <button
            type="submit"
            // モノクロデザインの適用: メインボタン (黒)
            className="px-4 py-2 bg-gray-800 rounded-xl text-white font-semibold shadow-md hover:bg-gray-900 transition-colors"
          >
            作成
          </button>
        </div>
      </form>


      {/* --- グループ一覧 --- */}
      <div className="space-y-4">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">マイグループ ({groupList.length} 件)</h3>
        {groupList.length === 0 ? (
          <div className="text-center p-8 bg-white rounded-2xl shadow-md border border-dashed border-gray-300">
            <p className="text-gray-600 font-medium">まだグループがありません。上記から新しいグループを作成してください。</p>
          </div>
        ) : (
          groupList.map(group => (
            <div
              key={group.id}
              // モノクロデザインの適用: ホバー時のリング
              className="p-5 bg-white rounded-2xl shadow-lg flex justify-between items-center transition duration-200 hover:shadow-xl hover:ring-2 hover:ring-gray-200 border border-gray-100"
            >
              <div className="flex-grow">
                <h3 className="text-xl font-bold text-gray-800">{group.name}</h3>
                <p className="text-sm text-gray-500 mt-1">カード数: {group.cards.length} 枚</p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => onSelectGroup(group.id)}
                  // モノクロデザインの適用: 学習開始ボタン (濃いグレー)
                  className="px-4 py-2 bg-gray-700 rounded-xl text-white font-semibold shadow-md hover:bg-gray-800 transition-colors"
                >
                  学習開始
                </button>
                <button
                  onClick={() => handleDeleteGroup(group.id)}
                  // モノクロデザインの適用: 削除ボタンのホバー色
                  className="p-2 bg-white border border-gray-300 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
                  title="グループを削除"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 6h6v10H7V6z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


// --- メインアプリコンポーネント ---
export default function App() {
  const [{ groups, nextGroupId, nextCardId }, setAppState] = useState(loadGroups);
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [studyGroupId, setStudyGroupId] = useState(null);

  // ローカルストレージにデータを保存する副作用
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(groups));
  }, [groups]);

  // グループのカードを更新するためのヘルパー関数
  const updateGroupCards = (groupId, newGroupData) => {
    setAppState(prev => ({
      ...prev,
      groups: {
        ...prev.groups,
        [groupId]: newGroupData,
      }
    }));
  };

  // グループ作成ロジック
  const handleCreateGroup = (groupName, id) => {
    const newGroup = {
      id: id,
      name: groupName,
      cards: [],
    };
    setAppState(prev => ({
      ...prev,
      groups: { ...prev.groups, [id]: newGroup }
    }));
  };

  // グループ削除ロジック
  const handleDeleteGroup = (groupId) => {
    setAppState(prev => {
      const newGroups = { ...prev.groups };
      delete newGroups[groupId];
      return { ...prev, groups: newGroups };
    });
  };

  // グループ選択ロジック
  const handleSelectGroup = (groupId) => {
    setStudyGroupId(groupId);
    setCurrentScreen('Study');
  };

  const currentGroup = studyGroupId ? groups[studyGroupId] : null;


  // --- 画面の切り替えとフォールバックロジック ---
  let content;

  if (currentScreen === 'Study' && currentGroup) {
    // 正常な学習画面表示
    content = (
      <StudyScreen
        group={currentGroup}
        setGroup={(newGroupData) => updateGroupCards(studyGroupId, newGroupData)}
        setScreen={setCurrentScreen}
        nextCardId={nextCardId}
        setNextCardId={(newId) => setAppState(prev => ({ ...prev, nextCardId: newId }))}
      />
    );
  } else {
    // Home画面表示、またはStudy画面でデータがない場合のフォールバック
    if (currentScreen === 'Study' && !currentGroup) {
      console.warn('学習中のグループデータが見つかりませんでした。ホーム画面に自動で戻ります。');
      setCurrentScreen('Home');
    }

    content = (
      <HomeScreen
        groups={groups}
        onCreateGroup={handleCreateGroup}
        onDeleteGroup={handleDeleteGroup}
        onSelectGroup={handleSelectGroup}
        nextGroupId={nextGroupId}
        setNextGroupId={(newId) => setAppState(prev => ({ ...prev, nextGroupId: newId }))}
      />
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col items-center justify-start font-sans p-4 pt-10">
      {content}
      {/* 3D反転のための Tailwind 補助クラスの定義 */}
      <style>{`
        .perspective-1000 {
            perspective: 1000px;
        }
        .rotate-y-180 {
            transform: rotateY(180deg);
        }
      `}</style>
    </div>
  );
}
