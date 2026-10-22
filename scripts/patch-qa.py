from pathlib import Path
p=Path(__file__).with_name('browser-qa.cjs')
s=p.read_text(encoding='utf-8').replace("p.locator('[name=\"quantity\"]').inputValue()","p.locator('#edit-form [name=\"quantity\"]').inputValue()")
p.write_text(s,encoding='utf-8')
