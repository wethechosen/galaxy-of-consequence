export type SourceDocument = { id: string; title: string; filename: string; authority: string; pages: number; indexedPages: number; ocrPages: number; reviewedPages: number; createdAt: string };
export type SourceHit = { documentId: string; title: string; authority: string; page: number; excerpt: string; extraction: string; reviewed: boolean };
export function listSourceDocuments(): SourceDocument[];
export function sourcePage(documentId: string, page: number): (SourceHit & { body: string }) | null;
export function reviewSourcePage(documentId: string, page: number, reviewed: boolean): boolean;
export function sourceFile(documentId: string): { id: string; title: string; filename: string; sourcePath: string } | null;
export function searchSources(query: string, limit?: number): SourceHit[];
export function sourceGrounding(query: string): string;
export function indexSourceFile(path: string, options?: { title?: string; authority?: string; maxPages?: number; onProgress?: (progress: { title: string; page: number; pages: number; extraction: string; chars: number }) => void }): Promise<{ id: string; title: string; pages: number; indexedPages: number; ocrPages: number }>;
