import { GITHUB_API_KEY, GITHUB_USERNAME } from './env';

export type Project = {
    name: string;
    description: string;
    html_url: string;
    homepage: string;
    language: string;
    stargazers_count: number;
    forks_count: number;
    watchers_count: number;
};

export async function getProjects() {
    const response = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos`, {
        headers: {
            Authorization: `token ${GITHUB_API_KEY}`
        }
    });

    return response.json();
}
