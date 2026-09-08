@echo off
python generate_data.py
python run_experiments.py
python sensitivity.py
python -m pytest -q
