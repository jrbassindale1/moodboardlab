#!/usr/bin/env python3
"""
Add all missing lifecycle profiles to constants.ts
"""

import re

# Material type profiles
PROFILES = {
    'timber': {
        'raw': {'impact': 1, 'confidence': 'high'},
        'manufacturing': {'impact': 2, 'confidence': 'high'},
        'transport': {'impact': 2, 'confidence': 'medium'},
        'installation': {'impact': 2, 'confidence': 'high'},
        'inUse': {'impact': 1, 'confidence': 'high'},
        'maintenance': {'impact': 2, 'confidence': 'medium'},
        'endOfLife': {'impact': 1, 'confidence': 'high'}
    },
    'ceramic': {
        'raw': {'impact': 2, 'confidence': 'high'},
        'manufacturing': {'impact': 5, 'confidence': 'high'},
        'transport': {'impact': 3, 'confidence': 'medium'},
        'installation': {'impact': 2, 'confidence': 'high'},
        'inUse': {'impact': 1, 'confidence': 'high'},
        'maintenance': {'impact': 1, 'confidence': 'high'},
        'endOfLife': {'impact': 2, 'confidence': 'medium'}
    },
    'metal': {
        'raw': {'impact': 5, 'confidence': 'high'},
        'manufacturing': {'impact': 5, 'confidence': 'high'},
        'transport': {'impact': 3, 'confidence': 'medium'},
        'installation': {'impact': 2, 'confidence': 'high'},
        'inUse': {'impact': 1, 'confidence': 'high'},
        'maintenance': {'impact': 1, 'confidence': 'high'},
        'endOfLife': {'impact': 1, 'confidence': 'high'}
    },
    'concrete': {
        'raw': {'impact': 3, 'confidence': 'high'},
        'manufacturing': {'impact': 5, 'confidence': 'high'},
        'transport': {'impact': 3, 'confidence': 'medium'},
        'installation': {'impact': 3, 'confidence': 'high'},
        'inUse': {'impact': 1, 'confidence': 'high'},
        'maintenance': {'impact': 1, 'confidence': 'high'},
        'endOfLife': {'impact': 3, 'confidence': 'medium'}
    },
    'glass': {
        'raw': {'impact': 3, 'confidence': 'high'},
        'manufacturing': {'impact': 4, 'confidence': 'high'},
        'transport': {'impact': 3, 'confidence': 'medium'},
        'installation': {'impact': 2, 'confidence': 'high'},
        'inUse': {'impact': 1, 'confidence': 'high'},
        'maintenance': {'impact': 1, 'confidence': 'high'},
        'endOfLife': {'impact': 3, 'confidence': 'medium'}
    },
    'plastic': {
        'raw': {'impact': 4, 'confidence': 'high'},
        'manufacturing': {'impact': 4, 'confidence': 'high'},
        'transport': {'impact': 2, 'confidence': 'medium'},
        'installation': {'impact': 1, 'confidence': 'high'},
        'inUse': {'impact': 1, 'confidence': 'high'},
        'maintenance': {'impact': 1, 'confidence': 'high'},
        'endOfLife': {'impact': 4, 'confidence': 'low'}
    },
    'earth': {
        'raw': {'impact': 1, 'confidence': 'high'},
        'manufacturing': {'impact': 1, 'confidence': 'high'},
        'transport': {'impact': 1, 'confidence': 'high'},
        'installation': {'impact': 2, 'confidence': 'medium'},
        'inUse': {'impact': 1, 'confidence': 'high'},
        'maintenance': {'impact': 1, 'confidence': 'high'},
        'endOfLife': {'impact': 1, 'confidence': 'high'}
    },
    'stone': {
        'raw': {'impact': 3, 'confidence': 'high'},
        'manufacturing': {'impact': 3, 'confidence': 'high'},
        'transport': {'impact': 4, 'confidence': 'medium'},
        'installation': {'impact': 2, 'confidence': 'high'},
        'inUse': {'impact': 1, 'confidence': 'high'},
        'maintenance': {'impact': 1, 'confidence': 'high'},
        'endOfLife': {'impact': 2, 'confidence': 'medium'}
    },
    'textile': {
        'raw': {'impact': 2, 'confidence': 'medium'},
        'manufacturing': {'impact': 3, 'confidence': 'medium'},
        'transport': {'impact': 2, 'confidence': 'medium'},
        'installation': {'impact': 1, 'confidence': 'high'},
        'inUse': {'impact': 1, 'confidence': 'high'},
        'maintenance': {'impact': 2, 'confidence': 'medium'},
        'endOfLife': {'impact': 2, 'confidence': 'low'}
    },
    'biobased': {
        'raw': {'impact': 1, 'confidence': 'high'},
        'manufacturing': {'impact': 1, 'confidence': 'high'},
        'transport': {'impact': 2, 'confidence': 'medium'},
        'installation': {'impact': 2, 'confidence': 'medium'},
        'inUse': {'impact': 1, 'confidence': 'high'},
        'maintenance': {'impact': 1, 'confidence': 'high'},
        'endOfLife': {'impact': 1, 'confidence': 'high'}
    },
    'paint': {
        'raw': {'impact': 3, 'confidence': 'medium'},
        'manufacturing': {'impact': 3, 'confidence': 'medium'},
        'transport': {'impact': 2, 'confidence': 'medium'},
        'installation': {'impact': 2, 'confidence': 'medium'},
        'inUse': {'impact': 1, 'confidence': 'high'},
        'maintenance': {'impact': 2, 'confidence': 'medium'},
        'endOfLife': {'impact': 2, 'confidence': 'low'}
    }
}

def classify_material(name, desc, keywords):
    """Classify material by keywords"""
    text = f"{name} {desc} {' '.join(keywords)}".lower()

    if re.search(r'timber|wood|oak|bamboo|larch|cedar|plywood', text):
        return 'timber'
    if re.search(r'steel|aluminum|aluminium|metal|brass|copper|zinc', text):
        return 'metal'
    if re.search(r'concrete|cement|microcement', text):
        return 'concrete'
    if re.search(r'glass|glazing', text):
        return 'glass'
    if re.search(r'ceramic|terracotta|porcelain|clay|brick|tile', text):
        return 'ceramic'
    if re.search(r'plastic|vinyl|upvc|composite|grp|pet|epoxy|resin', text):
        return 'plastic'
    if re.search(r'hemp|cork|mycelium|bio-based|biobased|wool|felt', text):
        return 'biobased'
    if re.search(r'earth|rammed|lime|plaster|render', text):
        return 'earth'
    if re.search(r'stone|marble|granite|slate|travertine', text):
        return 'stone'
    if re.search(r'fabric|textile|carpet|leather|upholster', text):
        return 'textile'
    if re.search(r'paint|emulsion', text):
        return 'paint'

    return 'concrete'  # default

def format_profile(mat_id, profile):
    """Format profile as TypeScript"""
    return f"""  '{mat_id}': {{
    raw: {{ impact: {profile['raw']['impact']}, confidence: '{profile['raw']['confidence']}' }},
    manufacturing: {{ impact: {profile['manufacturing']['impact']}, confidence: '{profile['manufacturing']['confidence']}' }},
    transport: {{ impact: {profile['transport']['impact']}, confidence: '{profile['transport']['confidence']}' }},
    installation: {{ impact: {profile['installation']['impact']}, confidence: '{profile['installation']['confidence']}' }},
    inUse: {{ impact: {profile['inUse']['impact']}, confidence: '{profile['inUse']['confidence']}' }},
    maintenance: {{ impact: {profile['maintenance']['impact']}, confidence: '{profile['maintenance']['confidence']}' }},
    endOfLife: {{ impact: {profile['endOfLife']['impact']}, confidence: '{profile['endOfLife']['confidence']}' }}
  }}"""

# Read constants.ts
with open('constants.ts', 'r') as f:
    content = f.read()

# Extract all material IDs and details from MATERIAL_PALETTE
material_section = re.search(r'export const MATERIAL_PALETTE.*?\[(.*?)\];', content, re.DOTALL)
if not material_section:
    print("Could not find MATERIAL_PALETTE")
    exit(1)

materials_text = material_section.group(1)
material_matches = re.finditer(
    r"\{\s*id:\s*'([^']+)'.*?name:\s*'([^']*)'.*?description:\s*'([^']*)'.*?keywords:\s*\[(.*?)\]",
    materials_text,
    re.DOTALL
)

materials = []
for match in material_matches:
    mat_id = match.group(1)
    name = match.group(2)
    desc = match.group(3)
    keywords_str = match.group(4)
    keywords = [k.strip().strip("'\"") for k in keywords_str.split(',')]
    materials.append({
        'id': mat_id,
        'name': name,
        'description': desc,
        'keywords': keywords
    })

print(f"Found {len(materials)} materials")

# Extract existing profiles
existing_profiles = set()
profiles_section = re.search(r'MATERIAL_LIFECYCLE_PROFILES.*?\{(.*?)\};', content, re.DOTALL)
if profiles_section:
    existing_matches = re.finditer(r"'([^']+)':\s*\{", profiles_section.group(1))
    for match in existing_matches:
        existing_profiles.add(match.group(1))

print(f"Found {len(existing_profiles)} existing profiles")

# Generate new profiles
new_profiles = []
for mat in materials:
    if mat['id'] not in existing_profiles:
        mat_type = classify_material(mat['name'], mat['description'], mat['keywords'])
        profile = PROFILES[mat_type]
        new_profiles.append(format_profile(mat['id'], profile))

print(f"Generated {len(new_profiles)} new profiles")

# Add comma to last existing profile
content = re.sub(
    r"(endOfLife: \{ impact: \d, confidence: '[^']+' \}\s*\}\s*)(\};)",
    r"\1,\n\n  // === AUTO-GENERATED PROFILES ===\n\n\2",
    content
)

# Insert new profiles before the closing brace
new_profiles_text = ',\n\n'.join(new_profiles)
content = re.sub(
    r"(// === AUTO-GENERATED PROFILES ===\n\n)(};)",
    rf"\1{new_profiles_text}\n\2",
    content
)

# Write back
with open('constants.ts', 'w') as f:
    f.write(content)

print(f"✅ Added {len(new_profiles)} new profiles to constants.ts")
print(f"✅ Total profiles: {len(existing_profiles) + len(new_profiles)}")
