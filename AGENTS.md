# Repository guidelines

- Prefer Python 3.11 when running local tooling.
- Run `ruff check .` and `pytest` before submitting changes that touch Python code.
- Keep helper scripts importable (avoid top-level work at import time) so they stay testable.
- Use UTF-8 encoding for text files and include trailing newlines.
- Treat the 2025-2026 NBA season as the current active season and the 2024-2025 campaign as the most recent completed season; ensure all data summaries, visualizations, and narratives call out this distinction explicitly.
- Never add or commit binary files to the repository.
