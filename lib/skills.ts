import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

export const PROJECT_ROOT = process.env.REVIEWFLOW_PROJECT_ROOT || process.cwd()
export const SKILLS_DIR = path.join(PROJECT_ROOT, ".claude", "skills")

export type Skill = {
  name: string
  description: string
  content: string
}

const NAME_RE = /^[a-zA-Z0-9._-]+$/

function parseFrontmatter(content: string): { name: string; description: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return { name: "", description: "" }
  const yaml = match[1]
  const name = yaml.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? ""
  const description = yaml.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? ""
  return { name, description }
}

export async function listSkills(): Promise<Skill[]> {
  await mkdir(SKILLS_DIR, { recursive: true })
  const entries = await readdir(SKILLS_DIR, { withFileTypes: true })
  const skills: Skill[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const skillPath = path.join(SKILLS_DIR, entry.name, "SKILL.md")
    try {
      const content = await readFile(skillPath, "utf8")
      const { name, description } = parseFrontmatter(content)
      skills.push({ name: name || entry.name, description, content })
    } catch {
      // ignore unreadable skill dirs
    }
  }
  return skills
}

export async function getSkill(name: string): Promise<Skill | null> {
  if (!NAME_RE.test(name)) throw new Error("Invalid skill name")
  try {
    const skillPath = path.join(SKILLS_DIR, name, "SKILL.md")
    const content = await readFile(skillPath, "utf8")
    const { name: parsedName, description } = parseFrontmatter(content)
    return { name: parsedName || name, description, content }
  } catch {
    return null
  }
}

export async function saveSkill(name: string, content: string): Promise<void> {
  if (!NAME_RE.test(name)) throw new Error("Invalid skill name")
  const dir = path.join(SKILLS_DIR, name)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, "SKILL.md"), content, "utf8")
}

export async function deleteSkill(name: string): Promise<void> {
  if (!NAME_RE.test(name)) throw new Error("Invalid skill name")
  await rm(path.join(SKILLS_DIR, name), { recursive: true, force: true })
}
