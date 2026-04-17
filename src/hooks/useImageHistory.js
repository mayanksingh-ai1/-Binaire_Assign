import { useState, useCallback } from 'react';

const MAX_HISTORY = 50;

export function useImageHistory() {
  const [history, setHistory] = useState([]); // Array of { type, imageData, adjustments }
  const [currentIndex, setCurrentIndex] = useState(-1);

  const pushHistory = useCallback((entry) => {
    setHistory((prev) => {
      // Discard any future states (after current index)
      const truncated = prev.slice(0, currentIndex + 1);
      const next = [...truncated, entry].slice(-MAX_HISTORY);
      setCurrentIndex(next.length - 1);
      return next;
    });
  }, [currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex <= 0) return null;
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    return history[newIndex];
  }, [currentIndex, history]);

  const redo = useCallback(() => {
    if (currentIndex >= history.length - 1) return null;
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    return history[newIndex];
  }, [currentIndex, history]);

  const goToIndex = useCallback((index) => {
    if (index < 0 || index >= history.length) return null;
    setCurrentIndex(index);
    return history[index];
  }, [history]);

  return {
    history,
    currentIndex,
    pushHistory,
    undo,
    redo,
    goToIndex,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
  };
}