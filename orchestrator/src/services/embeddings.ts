import { createHash } from 'crypto';

/**
 * Generate a simple embedding for a text string.
 * In a production system, this would call an actual embedding API.
 * For now, we'll use a simple hash-based approach.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Normalize text
  const normalized = text.toLowerCase().trim();
  
  // Simple tokenization
  const tokens = normalized.split(/\s+/);
  
  // Create a 128-dimensional embedding
  const embedding = new Array(128).fill(0);
  
  // Hash each token and distribute across dimensions
  for (const token of tokens) {
    const hash = createHash('md5').update(token).digest();
    
    for (let i = 0; i < hash.length; i++) {
      const dimension = i % embedding.length;
      embedding[dimension] += hash[i] / 255.0;
    }
  }
  
  // Normalize the embedding
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(text => generateEmbedding(text)));
}

/**
 * Calculate the centroid of multiple embeddings
 */
export function calculateCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) {
    throw new Error('Cannot calculate centroid of empty embeddings');
  }
  
  const dimensions = embeddings[0].length;
  const centroid = new Array(dimensions).fill(0);
  
  // Sum all embeddings
  for (const embedding of embeddings) {
    for (let i = 0; i < dimensions; i++) {
      centroid[i] += embedding[i];
    }
  }
  
  // Average
  for (let i = 0; i < dimensions; i++) {
    centroid[i] /= embeddings.length;
  }
  
  // Normalize
  const magnitude = Math.sqrt(centroid.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < dimensions; i++) {
      centroid[i] /= magnitude;
    }
  }
  
  return centroid;
}