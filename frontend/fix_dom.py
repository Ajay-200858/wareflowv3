import os, glob

path = "c:/Users/ajays/OneDrive/Desktop/wareflow_frontend_v3/frontend/js/**/*.js"
for file_path in glob.glob(path, recursive=True):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content.replace(
        "document.getElementById('main-content') || document.querySelector('.main-content')",
        "document.getElementById('router-view')"
    )
    
    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Fixed {file_path}")
