with open('backend/app/api/orders.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

import_start = -1
for i, line in enumerate(lines):
    if line.startswith('@router.post("/import")'):
        import_start = i
        break

if import_start != -1:
    import_block = lines[import_start:]
    other_block = lines[:import_start]
    
    insert_idx = -1
    for i, line in enumerate(other_block):
        if line.startswith('@router.get("/{order_id}"'):
            insert_idx = i
            break
            
    if insert_idx != -1:
        new_lines = other_block[:insert_idx] + import_block + ['\n'] + other_block[insert_idx:]
        with open('backend/app/api/orders.py', 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print('Moved import block successfully!')
