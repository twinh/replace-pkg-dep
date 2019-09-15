declare module 'github-branches' {
  function githubBranches(repo: string): Promise<any>

  export = githubBranches
}
