---
title: "Effortless Secret Management for Laravel & JS Projects with Secrets Loader"
description: "Managing sensitive data like API keys, tokens, and credentials across various environments can be quite tricky, especially when developing and deploying applications. Ensuring secrets are securely stored and fetched when needed, without hardcoding them into version control, is crucial for maintaining security."
published_at: Sep 19, 2024
---

# Effortless Secret Management for Laravel & JS Projects with Secrets Loader

### What is Secrets Loader?

**Secrets Loader** is a simple tool designed to automatically fetch secrets from AWS SSM Parameter Store and AWS CloudFormation outputs based on custom syntax in your `.env` file. It replaces placeholders with actual secrets without ever exposing sensitive information in version control.

For example, instead of hardcoding your API keys or credentials, you define them in your `.env` file like this:

```env
THIRD_PARTY_API_KEY="ssm:/third-party/api/key"
AWS_ACCESS_KEY_ID="cf:my-stack:AccessKeyId"
```

With a single command, Secrets Loader will fetch the actual values from AWS and update your `.env` file, keeping sensitive information secure and easy to manage.

---

### Why I Built It

During local development and deployment, I found myself dealing with sensitive credentials that I didn't want hardcoded into the project files. Having used AWS services extensively, I wanted a way to integrate secret management into my existing development workflow without too much hassle.

Here are the main challenges Secrets Loader solves:

1. **Avoiding hardcoded secrets**: No more committing secrets to version control. You can safely use placeholders and dynamically fetch the actual values from AWS SSM and CloudFormation.
2. **Reducing manual effort**: Instead of manually copying and pasting secret values, just define them once in your `.env` file, and let the script do the fetching.
3. **Simplifying secret management**: Whether you're working in local development, staging, or production, Secrets Loader ensures that secrets are securely and automatically loaded.

---

### Features

**Secrets Loader** comes with a few key features that make it a handy tool for both local development and production environments:

- **Automated secret loading**: Fetch secrets from AWS SSM Parameter Store and CloudFormation by specifying paths in your `.env` file.
- **Security-first approach**: Keep sensitive data out of version control by securely loading it at runtime.
- **Simple syntax**: Use a custom syntax in your `.env` file (`ssm:` for SSM parameters, `cf:` for CloudFormation outputs) to specify where secrets should come from.
- **Error handling**: The script continues to process other secrets even if one retrieval fails, logging warnings without stopping your workflow.

---

### How It Works

The magic of **Secrets Loader** lies in its ability to fetch secrets from AWS based on specific prefixes (`ssm:` and `cf:`). Here's an example workflow:

1. **Set up your `.env` file**:

   Add placeholders for your secrets in your `.env` file using the `ssm:` prefix for SSM parameters or the `cf:` prefix for CloudFormation outputs:

   ```env
   THIRD_PARTY_API_KEY="ssm:/third-party/api/key"
   AWS_SECRET_ACCESS_KEY="cf:my-stack:SecretAccessKey"
   ```

2. **Run the script**:

   Use the following command to run the script and fetch the secrets:

   ```bash
   ./secrets.sh
   ```

3. **Updated `.env` file**:

   After running the script, your `.env` file will be updated with the actual values fetched from AWS:

   ```env
   THIRD_PARTY_API_KEY=actual-api-key-value
   AWS_SECRET_ACCESS_KEY=actual-access-key-value
   ```

No more hardcoding secrets, and no more manual lookups!

---

### Installation & Setup

Ready to get started? Here's how you can set up **Secrets Loader** in your project:

1. **Clone the repository**:

   ```bash
   git clone https://github.com/Thavarshan/secretst-loader.git
   cd secretst-loader
   ```

2. **Make the script executable**:

   ```bash
   chmod +x secrets.sh
   ```

3. **Ensure AWS CLI is installed and configured**:

   If you don’t have the AWS CLI installed, follow the [AWS CLI installation guide](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html). After installing, configure your AWS credentials:

   ```bash
   aws configure
   ```

4. **Define your secrets in `.env`**:

   Use the `ssm:` and `cf:` prefixes to define where secrets should come from:

   ```env
   THIRD_PARTY_API_KEY="ssm:/third-party/api/key"
   AWS_ACCESS_KEY_ID="cf:my-stack:AccessKeyId"
   ```

---

### Example Usage

Let’s take a look at a simple example:

#### `.env.example` File:

```env
# Application settings
APP_NAME=MyApp
APP_ENV=production

# Secrets fetched from AWS SSM and CloudFormation
THIRD_PARTY_API_KEY="ssm:/third-party/api/key"
AWS_SECRET_ACCESS_KEY="cf:my-stack:SecretAccessKey"
```

#### Running Secrets Loader:

```bash
./secrets.sh
```

#### Updated `.env` File:

```env
# Application settings
APP_NAME=MyApp
APP_ENV=production

# Fetched secrets
THIRD_PARTY_API_KEY=actual-api-key-value
AWS_SECRET_ACCESS_KEY=actual-secret-access-key
```

---

### Troubleshooting

If you encounter any issues while using **Secrets Loader**, here are a few things to check:

1. **AWS Permissions**: Ensure that the AWS CLI is configured correctly and that your IAM role or user has sufficient permissions to access AWS SSM and CloudFormation secrets.

2. **Syntax Errors**: Double-check the syntax in your `.env` file to make sure the `ssm:` and `cf:` prefixes are correct.

3. **Script Errors**: If the script fails to fetch certain secrets, it will log warnings but continue fetching the others. Review the logs for any error messages and make sure the AWS resources exist and are accessible.

---

### Extending Secrets Loader

The script is designed to be extensible. If you'd like to integrate other secret management systems (like Azure Key Vault or HashiCorp Vault), you can easily modify the script to support new prefixes and fetch logic.

For example, you could add an `azkv:` prefix to fetch secrets from Azure Key Vault and handle the retrieval using the Azure CLI.

---

### Contributing

**Secrets Loader** is open-source, and contributions are always welcome! If you'd like to add features, fix bugs, or suggest improvements, feel free to:

- **Open an issue**: Share your feedback or bug reports.
- **Submit a pull request**: Contribute code by following our [CONTRIBUTING guidelines](https://github.com/Thavarshan/secrets-loader/blob/main/CONTRIBUTING.md).

---

### Conclusion

If you're tired of manually managing secrets across environments, **Secrets Loader** is a simple, effective tool to streamline the process. By fetching secrets dynamically from AWS SSM and CloudFormation, you can securely manage your credentials without risking exposure in version control.

Check out the project on [GitHub](https://github.com/Thavarshan/secrets-loader), give it a try, and if you find it useful, **give us a ⭐ on GitHub!** Your support helps the project grow, and we'd love to hear your feedback or see your contributions to its ongoing development.
