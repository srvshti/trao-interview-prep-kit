export function deriveWeakSpots(flashcards, confidenceByCardId) {
  return flashcards
    .map((card) => ({ id: card.id, front: card.front, confidence: confidenceByCardId[card.id] }))
    .filter((card) => Number.isInteger(card.confidence) && card.confidence <= 1)
    .sort((a, b) => a.confidence - b.confidence || a.front.localeCompare(b.front));
}
