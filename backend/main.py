from app.main import app

if __name__ == "__main__":
    import subprocess
    subprocess.run([
        "gunicorn", "app.main:app",
        "--bind", "0.0.0.0:8000",
        # "--workers", "4",
        # "--threads", "4",
        "--worker-class", "gthread",
    ])
