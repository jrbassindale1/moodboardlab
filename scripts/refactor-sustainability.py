#!/usr/bin/env python3
"""
Refactor Moodboard.tsx to use consolidated sustainability prompt
"""

import re

# Read the backup
with open('components/Moodboard.tsx.backup', 'r') as f:
    content = f.read()

# Step 1: Replace old lifecycle types with new sustainability insight type
old_types = r"""type LifecycleSplit = \{[^}]+\};

type LifecycleEntry = \{[^}]+\};

const LIFECYCLE_PHASES:[^;]+;"""

new_type = """type SustainabilityInsight = {
  id: string;
  title: string;
  headline: string;
  hotspots: string[];
  whyItLooksLikeThis: string;
  designLevers: string[];
  whatCouldChange: string[];
  ukChecks: string[];
};"""

content = re.sub(old_types, new_type, content, flags=re.DOTALL)

# Step 2: Replace state variables
old_state = r"""  const \[analysis, setAnalysis\] = useState<string \| null>\(null\);
  const \[analysisStructured, setAnalysisStructured\] = useState<[^>]+>\([^)]+\);
  const analysisRef = useRef<[^>]+>\([^)]+\);
  const analysisStructuredRef = useRef<[^>]+>\([^)]+\);
  const \[lifecycleAnalysis, setLifecycleAnalysis\] = useState<string \| null>\(null\);
  const \[lifecycleStructured, setLifecycleStructured\] = useState<[^>]+>\([^)]+\);
  const lifecycleAnalysisRef = useRef<[^>]+>\([^)]+\);
  const lifecycleStructuredRef = useRef<[^>]+>\([^)]+\);"""

new_state = """  const [sustainabilityInsights, setSustainabilityInsights] = useState<SustainabilityInsight[] | null>(null);
  const sustainabilityInsightsRef = useRef<SustainabilityInsight[] | null>(null);"""

content = re.sub(old_state, new_state, content, flags=re.DOTALL)

# Step 3: Update accordion state
content = content.replace(
    'const [analysisAccordionOpen, setAnalysisAccordionOpen] = useState(true);',
    'const [sustainabilityAccordionOpen, setSustainabilityAccordionOpen] = useState(true);'
)
content = content.replace('const [lifecycleAccordionOpen, setLifecycleAccordionOpen] = useState(true);', '')

# Step 4: Update runMoodboardFlow to call single sustainability endpoint
old_flow = r"""    try \{
      await runGemini\('analysis'\);
      await runGemini\('lifecycle'\);
      await runGemini\('render'"""

new_flow = """    try {
      await runGemini('sustainability');
      await runGemini('render'"""

content = re.sub(old_flow, new_flow, content)

# Step 5: Update initialization in runMoodboardFlow
old_init = r"""    setMaterialKey\(buildMaterialKey\(\)\);
    setAnalysis\(null\);
    setAnalysisStructured\(null\);
    setLifecycleAnalysis\(null\);
    setLifecycleStructured\(null\);"""

new_init = """    setMaterialKey(buildMaterialKey());
    setSustainabilityInsights(null);"""

content = re.sub(old_init, new_init, content)

# Write output
with open('components/Moodboard.tsx', 'w') as f:
    f.write(content)

print("✅ Basic refactoring complete")
print("⚠️  Manual steps still needed:")
print("   1. Update runGemini function to handle 'sustainability' mode")
print("   2. Build sustainability prompt with fingerprints")
print("   3. Replace UI sections")
print("   4. Update PDF generation")
