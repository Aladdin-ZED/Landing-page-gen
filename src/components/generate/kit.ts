/**
 * The generator's heavy half — direction building and its mood-aware style ranking (section
 * registry, every section's copy, the plan rules), the copy family a product reads as, and the
 * hand-written copy library with the AI-copy guard. Never imported statically:
 * the wizard loads it on demand through ./kit-loader, so the first step opens without it.
 */
export { copyCategory, generateDirections, productKeywords, rankDirections } from "@/lib/generator";
export { libraryCopy } from "@/lib/ai/copy-library";
export { mergeAiCopy } from "@/lib/ai/guard";
