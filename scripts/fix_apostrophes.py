# -*- coding: utf-8 -*-
"""
Fixes unescaped apostrophes inside single-quoted TypeScript string literals.
Approach: scan char by char, track when we're inside a single-quoted string,
and escape any bare apostrophe that would break the string.
"""

with open(r'c:\Users\MSI\AI_Assessment\lib\rwanda-curriculum.ts', encoding='utf-8') as f:
    content = f.read()

result = []
i = 0
n = len(content)

while i < n:
    ch = content[i]

    # Start of a single-quoted string
    if ch == "'":
        result.append(ch)
        i += 1
        # Scan until closing unescaped apostrophe
        while i < n:
            c = content[i]
            if c == '\\':
                # Keep escaped char as-is
                result.append(c)
                i += 1
                if i < n:
                    result.append(content[i])
                    i += 1
            elif c == "'":
                # Closing quote — check if the next char makes this a mid-string apostrophe.
                # Heuristic: if followed by a letter (like 's ), it's a possessive inside a string
                # and should be escaped. The actual closing quote is followed by , or \n or ].
                if i + 1 < n and content[i + 1].isalpha():
                    # This is an unescaped apostrophe mid-string (e.g. Children's)
                    result.append("\\'")
                    i += 1
                else:
                    # Closing quote
                    result.append(c)
                    i += 1
                    break
            else:
                result.append(c)
                i += 1
    elif ch == '`':
        # Template literal — skip until closing backtick (handle nested ${...})
        result.append(ch)
        i += 1
        depth = 0
        while i < n:
            c = content[i]
            if c == '\\':
                result.append(c)
                i += 1
                if i < n:
                    result.append(content[i])
                    i += 1
            elif c == '$' and i + 1 < n and content[i + 1] == '{':
                result.append(c)
                i += 1
                depth += 1
            elif c == '}' and depth > 0:
                result.append(c)
                i += 1
                depth -= 1
            elif c == '`' and depth == 0:
                result.append(c)
                i += 1
                break
            else:
                result.append(c)
                i += 1
    elif ch == '"':
        # Double-quoted string — copy as-is
        result.append(ch)
        i += 1
        while i < n:
            c = content[i]
            result.append(c)
            i += 1
            if c == '\\':
                if i < n:
                    result.append(content[i])
                    i += 1
            elif c == '"':
                break
    elif ch == '/' and i + 1 < n and content[i + 1] == '/':
        # Line comment — copy to end of line
        while i < n and content[i] != '\n':
            result.append(content[i])
            i += 1
    elif ch == '/' and i + 1 < n and content[i + 1] == '*':
        # Block comment
        result.append(ch)
        i += 1
        while i < n:
            if content[i] == '*' and i + 1 < n and content[i + 1] == '/':
                result.append(content[i])
                result.append(content[i + 1])
                i += 2
                break
            result.append(content[i])
            i += 1
    else:
        result.append(ch)
        i += 1

fixed = ''.join(result)

with open(r'c:\Users\MSI\AI_Assessment\lib\rwanda-curriculum.ts', 'w', encoding='utf-8') as f:
    f.write(fixed)

print(f"Done. File length: {len(fixed):,} chars")
