import re

with open('components/AdminOwnerDashboard.js', 'r') as f:
    content = f.read()

# We can search for the start and end of tabs
# We just need to know the lines.
lines = content.split('\n')
for i, line in enumerate(lines):
    if "activeTab ===" in line:
        print(f"Line {i+1}: {line.strip()}")

