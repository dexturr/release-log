const core = require("@actions/core");
const fetch = require("node-fetch");

const generateLines = (items) =>
  items
    .map(({ title, html_url, body, number }) => {
      const bodyWithQuote = body
        ? `> ${body.split("\r\n").join("\r\n >")}`
        : "\r\n";
      return `  ### [${title}](${html_url})\r\n\r\n${bodyWithQuote}`;
    })
    .join("\r\n");

const run = async () => {
  try {
    const repo = core.getInput("repo");
    const githubToken = process.env.GITHUB_TOKEN;
    const previousRelease = core.getInput("previousRelease");
    const newRelease = core.getInput("nextRelease");
    const filter = core.getInput("filter")
      ? JSON.parse(core.getInput("filter"))
      : [];

    const lastVersionTag = `https://api.github.com/repos/vegaprotocol/token-frontend/git/matching-refs/tags/${previousRelease}`;
    const versionResponse = await fetch(lastVersionTag, {
      headers: {
        Authorization: `token ${githubToken}`,
      },
    });
    if (versionResponse.status !== 200) {
      throw new Error("Could not authenticate with repository");
    }
    const tagJson = await versionResponse.json();
    const commitUrl = tagJson[0].object.url;
    const commitResponse = await fetch(commitUrl, {
      headers: {
        Authorization: `token ${githubToken}`,
      },
    });
    const commitJson = await commitResponse.json();
    const dateToday = new Date().toISOString().split("T")[0];
    const prEndpoint = `https://api.github.com/search/issues?q=repo:${repo}+is:pr+is:merged+sort:merged-date+merged:>${commitJson.committer.date}`;
    console.log(prEndpoint);
    const response = await fetch(prEndpoint, {
      headers: {
        Authorization: `token ${githubToken}`,
      },
    });
    const prJson = await response.json();
    const prFilter = ({ title }) => !filter.some((f) => f.includes(title));
    const prs = prJson.items.filter(prFilter);
    if (prs.length) {
      const features = prs.filter(({ title }) =>
        title.toLowerCase().startsWith("feat")
      );
      const fixes = prs.filter(
        ({ title }) =>
          title.toLowerCase().startsWith("hotfix") ||
          title.toLowerCase().startsWith("fix")
      );
      const rest = prs.filter(
        (pr) => !features.includes(pr) && !fixes.includes(pr)
      );

      const featuresText = generateLines(features);
      const fixesText = generateLines(fixes);
      const otherText = generateLines(rest);

      const message = `# Release ${newRelease} (${dateToday})
## Features :rocket:
${featuresText}

## Fixes :bug:
${fixesText}

## Other improvements
${otherText}
`;
      core.setOutput("release-notes", message);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
};

run();
