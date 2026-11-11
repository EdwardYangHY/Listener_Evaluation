# S2ST Listening Test

https://edwardyanghy.github.io/Listener_Evaluation/

20 conversations (10 English → Chinese and 10 Chinese → English), source audio and four anonymous system outputs per conversation. The interface follows the supplied PDF: full rating rubric, one conversation at a time, System A–D cards, source/ASR transcripts, numbered navigation and a fixed export bar.

Five independent 1–5 ratings (Speaker Similarity, Prosody Similarity, Conversational Naturalness, Translation Quality, Overall Quality) plus binary 0/1 Speaker Turn per output: 480 ratings total. Ratings start blank; zero is a completed binary rating. Output transcripts are ASR results for reference only, not ground truth.

Enter a unique assigned rater ID. System orders are randomized per conversation on first use and preserved in this browser. Progress is saved by rater ID and dataset fingerprint. Use the same browser/device to resume. Export JSON or UTF-8 CSV and send it to the study coordinator; nothing is submitted automatically. Partial exports contain all 80 output rows with unanswered dimensions blank. Clear all affects only the active rater after confirmation and preserves assignment order.

Exports contain rater ID, fingerprint, sample ID, output ID, displayed system label, direction, dataset, six ratings and session update time. Join output_id to the local private study mapping for analysis. A–D labels are not global system identities. Deduplicate multiple exports from the same rater before analysis.

Public assets: index.html, styles.css, app.js, study_data.js and audio/. No build or dependencies are needed. Current assets omit system identities; the former demonstration remains in Git history, so this is UI blinding rather than adversarial secrecy.

GitHub Pages serves main at the repository root. Keep research mappings, raw manifests, and participant exports local. The existing Subjective_Evaluation text study is a separate deployment.
