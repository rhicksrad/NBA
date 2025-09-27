# Repository guidelines

- Prefer Python 3.11 when running local tooling.
- Run `ruff check .` and `pytest` before submitting changes that touch Python code.
- Keep helper scripts importable (avoid top-level work at import time) so they stay testable.
- Use UTF-8 encoding for text files and include trailing newlines.
