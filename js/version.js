const OWNER = "raphaelbiagi";
const REPO = "BrazillianFishing-Wild-Waters-Site";

async function loadLatestRelease() {
  const version = document.getElementById("game-version");
  const date = document.getElementById("release-date");
  const button = document.getElementById("download-button");

  try {
    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`
    );

    if (!response.ok) {
      throw new Error("Não foi possível consultar a Release.");
    }

    const release = await response.json();
    const nome = release.name || release.tag_name;

    version.textContent = nome;

    date.textContent = release.published_at
      ? `Publicado em ${new Date(release.published_at).toLocaleDateString("pt-BR")}`
      : "";

    // Link direto para o .zip da release; se não houver, abre a página da release
    const zip = (release.assets || []).find((a) => a.name.toLowerCase().endsWith(".zip"));
    button.href = zip ? zip.browser_download_url : release.html_url;
  } catch (error) {
    version.textContent = "indisponível";
    console.error(error);
  }
}

loadLatestRelease();
