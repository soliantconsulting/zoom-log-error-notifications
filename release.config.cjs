module.exports = {
    branches: ["main"],
    plugins: [
        "@semantic-release/commit-analyzer",
        "@semantic-release/release-notes-generator",
        "@semantic-release/changelog",
        "@semantic-release/npm",
        [
            "@semantic-release/github",
            {
                successComment: false,
                failTitle: false,
            },
        ],
        [
            "@semantic-release/git",
            {
                assets: ["CHANGELOG.md", "package.json", "package-lock.json"],
                message:
                    "chore(release): set `package.json` to ${nextRelease.version} [skip ci]" +
                    "\n\n${nextRelease.notes}",
            },
        ],
    ],
};
