"""
Script to convert all relative imports to absolute imports
"""

import os
import re
from pathlib import Path

def fix_relative_imports(file_path: Path):
    """Convert relative imports to absolute imports in a Python file"""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Pattern to match relative imports
    # from . import something
    # from .module import something
    # from ..module import something
    patterns = [
        (r'^from \.\. import (.+)$', r'from \1'),  # from .. import x -> from x
        (r'^from \.\.([a-zA-Z_][a-zA-Z0-9_]*) import (.+)$', r'from \1 import \2'),  # from ..module import x -> from module import x
        (r'^from \. import (.+)$', r'from \1'),  # from . import x -> from x  
        (r'^from \.([a-zA-Z_][a-zA-Z0-9_]*) import (.+)$', r'from \1 import \2'),  # from .module import x -> from module import x
    ]
    
    lines = content.split('\n')
    new_lines = []
    
    for line in lines:
        new_line = line
        for pattern, replacement in patterns:
            if re.match(pattern, line):
                new_line = re.sub(pattern, replacement, line, flags=re.MULTILINE)
                break
        new_lines.append(new_line)
    
    new_content = '\n'.join(new_lines)
    
    if new_content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"[OK] Fixed imports in: {file_path}")
        return True
    return False

def main():
    backend_dir = Path(__file__).parent
    
    # Find all Python files
    py_files = list(backend_dir.rglob('*.py'))
    
    # Skip test files and this script
    py_files = [
        f for f in py_files 
        if 'test' not in str(f).lower() 
        and 'build' not in str(f)
        and 'dist' not in str(f)
        and f.name != 'fix_imports.py'
    ]
    
    print(f"Found {len(py_files)} Python files to process")
    
    fixed_count = 0
    for py_file in py_files:
        if fix_relative_imports(py_file):
            fixed_count += 1
    
    print(f"\n[OK] Fixed imports in {fixed_count} files")

if __name__ == '__main__':
    main()
