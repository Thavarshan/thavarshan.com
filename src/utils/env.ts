const dev = import.meta.env.DEV;

export const GITHUB_USERNAME = dev ? import.meta.env.GITHUB_USERNAME : process.env.GITHUB_USERNAME;
export const GITHUB_API_KEY = dev ? import.meta.env.GITHUB_API_KEY : process.env.GITHUB_API_KEY;
export const ENABLE_BLOG = dev ? import.meta.env.ENABLE_BLOG : process.env.ENABLE_BLOG;
