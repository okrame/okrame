import { graphql } from "@octokit/graphql";
import { increaseCounter } from "./utils";
import { Edge, EdgeInfo, UserInfo } from "./types";

export async function getUserInfo(username: string): Promise<UserInfo> {

  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${process.env.API_TOKEN}`,
    },
  });

  increaseCounter('userInfo')

  const { user }: any = await graphqlWithAuth(`
    query($login: String!){
      user(login: $login) {
          id
          createdAt
      }
  }
  `, {
    login: username,
  });

  return { id: user.id, createdAt: user.createdAt }
}

export async function getEdges(
  affiliation: string[],
  cursor: string | undefined,
  edges: Edge[]
): Promise<Edge[]> {

  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${process.env.API_TOKEN}`,
    },
  });

  increaseCounter('edges')

  try {
    const { user }: any = await graphqlWithAuth(`
      query ($owner_affiliation: [RepositoryAffiliation], $username: String!, $cursor: String) {
        user(login: $username) {
            repositories(first: 60, after: $cursor, ownerAffiliations: $owner_affiliation) {
            edges {
                node {
                    ... on Repository {
                        nameWithOwner
                        defaultBranchRef {
                            target {
                                ... on Commit {
                                    history {
                                        totalCount
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                pageInfo {
                    endCursor
                    hasNextPage
                }
            }
        }
    }
    `, {
      owner_affiliation: affiliation,
      username: process.env.GITHUB_USERNAME,
      cursor
    });

    if (user.repositories.pageInfo.hasNextPage) {
      const newEdges = edges.concat(user.repositories.edges)
      return getEdges(affiliation, user.repositories.pageInfo.endCursor, newEdges)
    } else {
      const newEdges = edges.concat(user.repositories.edges)
      return newEdges
    }

  } catch (e) {
    let message = 'Unknown Error'
    if (e instanceof Error) message = e.message
    console.log(`An error occurred while fetching profile edges: ${message}. Only already collected edges will be used`)
    return edges
  }
}

export async function getEdgesFromOrgs(
  cursor: string | undefined,
  edges: Edge[]
): Promise<Edge[]> {
  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${process.env.API_TOKEN}`,
    },
  });

  increaseCounter('orgEdges')

  try {
    const { user }: any = await graphqlWithAuth(`
      query ($username: String!, $cursor: String) {
        user(login: $username) {
          organizations(first: 60, after: $cursor) {
            edges {
              node {
                repositories(first: 60) {
                  edges {
                    node {
                      ... on Repository {
                        nameWithOwner
                        defaultBranchRef {
                          target {
                            ... on Commit {
                              history {
                                totalCount
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                  pageInfo {
                    endCursor
                    hasNextPage
                  }
                }
              }
            }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
      }
    `, {
      username: process.env.GITHUB_USERNAME,
      cursor
    });

    // Flatten organization repositories
    const orgRepoEdges = user.organizations.edges.flatMap(
      (org: any) => org.node.repositories.edges
    );

    const newEdges = edges.concat(orgRepoEdges);

    // Check if there are more organizations
    if (user.organizations.pageInfo.hasNextPage) {
      return getEdgesFromOrgs(
        user.organizations.pageInfo.endCursor,
        newEdges
      );
    } else {
      return newEdges
    }
  } catch (e) {
    let message = 'Unknown Error'
    if (e instanceof Error) message = e.message
    console.log(`An error occurred while fetching orgs edges: ${message}. Only already collected edges will be used`)
    return edges
  }
}

export async function getRepoInfo(
  repoName: string,
  owner: string,
  ownerId: string,
  cursor: string | undefined,
  additions: number,
  deletions: number,
  commits: number
): Promise<EdgeInfo> {
  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${process.env.API_TOKEN}`,
    },
  });

  increaseCounter('repoInfo')

  const { repository }: any = await graphqlWithAuth(`
      query ($repo_name: String!, $owner: String!, $cursor: String) {
        repository(name: $repo_name, owner: $owner) {
            defaultBranchRef {
                target {
                    ... on Commit {
                        history(first: 100, after: $cursor) {
                            totalCount
                            edges {
                                node {
                                    ... on Commit {
                                        committedDate
                                    }
                                    author {
                                        user {
                                            id
                                        }
                                    }
                                    deletions
                                    additions
                                }
                            }
                            pageInfo {
                                endCursor
                                hasNextPage
                            }
                        }
                    }
                }
            }
        }
    }
    `, {
    repo_name: repoName,
    owner: owner,
    cursor
  });

  if (!repository.defaultBranchRef) return { additions: 0, deletions: 0, commits: 0, totalCommits: 0 }

  for (var e of repository.defaultBranchRef.target.history.edges) {
    if (e.node.author.user?.id == ownerId) {
      commits += 1
      additions += e.node.additions
      deletions += e.node.deletions
    }
  }

  if (
    repository.defaultBranchRef.target.history.edges.length == 0 ||
    !repository.defaultBranchRef.target.history.pageInfo.hasNextPage
  ) {
    return { additions, deletions, commits, totalCommits: repository.defaultBranchRef.target.history.totalCount }
  } else {
    return getRepoInfo(
      repoName,
      owner,
      ownerId,
      repository.defaultBranchRef.target.history.pageInfo.endCursor,
      additions,
      deletions,
      commits
    )
  }
}