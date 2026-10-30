/**
 * SuperAgent Tool - Private Repo Reader (Kaalvan_REA)
 */
export class ReaInspector {
    static async getFile(path = "", env = {}) {
        const token = env.GITHUB_TOKEN || (typeof process !== "undefined" && process?.env?.GITHUB_TOKEN) || "";
        const owner = env.GITHUB_REPO_OWNER || "rajeshn-tech";
        const repo = env.GITHUB_REPO_NAME || "Kaalvan_REA";

        if (!token) return null;
        try {
            const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
            const res = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "User-Agent": "SuperAgent",
                    "Accept": "application/vnd.github.v3+json"
                }
            });
            if (!res.ok) return null;
            const data = await res.json();
            if (data.content && data.encoding === "base64") {
                return atob(data.content.replace(/\s/g, ""));
            }
            return data;
        } catch {
            return null;
        }
    }
}