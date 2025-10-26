# Flashcards Page

Copy this folder (`src/features/flashcards`) into any Vite + React project to reuse the flashcard experience as a standalone page.

## Usage

1. Copy the entire `flashcards` folder into `src/features` (or any folder you prefer) of the target project.
2. Import the page where you want to render it:

```jsx
import FlashcardsPage from './features/flashcards/FlashcardsPage';

export default function App() {
  return <FlashcardsPage />;
}
```

3. Ensure the host project already includes a global reset (e.g. `index.css`). The flashcard page ships with its own scoped stylesheet (`flashcards.css`).
4. Existing sample cards live in `initialGroups.json`. Feel free to replace or extend the data.

The component stores newly-created and AI-generated cards in `localStorage` under the key `flashcard_groups_v6_data`.
