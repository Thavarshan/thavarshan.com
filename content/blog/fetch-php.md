---
title: "FetchPHP: A Simple, Powerful HTTP Library for PHP, Inspired by JavaScript’s fetch API"
description: "I’m excited to introduce **FetchPHP**, a lightweight HTTP library for PHP that takes direct inspiration from JavaScript’s `fetch` API. If you’ve ever found yourself making HTTP requests in PHP and thinking *'I wish this was as simple as JavaScript’s fetch,'* then this package is for you!"
published_at: Sep 13, 2024
---

# FetchPHP: A Simple, Powerful HTTP Library for PHP, Inspired by JavaScript’s fetch API

### 💡 What is FetchPHP?

FetchPHP is a new, modern HTTP library built on top of Guzzle, designed to make working with HTTP requests in PHP both simple and powerful. Just like its JavaScript inspiration, FetchPHP allows you to send asynchronous or synchronous requests, easily handle JSON, multipart, or form data, and comes with built-in status helpers to make handling responses a breeze.

### ✨ Key Features

Here’s a quick overview of the features FetchPHP brings to the table:

- **Synchronous and Asynchronous Support**: You can choose between `fetch` (synchronous) and `fetchAsync` (asynchronous), giving you flexibility based on your needs.
- **Familiar API**: If you’re used to JavaScript’s `fetch` API, you’ll feel right at home. FetchPHP’s API mirrors that simplicity and ease of use.
- **Support for JSON, Multipart, and Form Data**: Easily handle different types of requests and responses, whether you’re sending JSON or uploading files.
- **Handy Status Helpers**: FetchPHP includes built-in helpers like `ok()`, `isClientError()`, `isServerError()`, and more to simplify handling response statuses.
- **Easy Authentication and Proxies**: Need to authenticate or route through a proxy? FetchPHP has you covered.

### 🚀 Getting Started

FetchPHP is available via Composer, so adding it to your project is super simple. Here’s how to get started:

1. **Install FetchPHP**:

```bash
composer require yourusername/fetchphp
```

2. **Make a Request**:

```php
<?php

require 'vendor/autoload.php';

use function FetchPHP\fetch;

$response = fetch('https://jsonplaceholder.typicode.com/todos/1');

// Get the JSON response
$data = $response->json();
print_r($data);
```

In the example above, we’re making a simple GET request and parsing the JSON response. You’ll notice that FetchPHP makes working with HTTP requests in PHP as clean as working with the `fetch` API in JavaScript.

### 🛠️ Example Use Cases

#### **Making a POST Request with JSON Data**

Need to send data to an API? Here’s how easy it is to use FetchPHP for a `POST` request:

```php
$response = fetch('https://jsonplaceholder.typicode.com/posts', [
    'method' => 'POST',
    'json' => [
        'title' => 'New Post',
        'body' => 'This is the content of the new post.',
        'userId' => 1,
    ],
]);

echo $response->statusText(); // Should print "Created"
print_r($response->json());
```

#### **Handling Asynchronous Requests**

FetchPHP also supports asynchronous requests using `fetchAsync`. This is especially useful for performance-critical tasks where you don’t want to block execution:

```php
$promise = fetchAsync('https://jsonplaceholder.typicode.com/todos/1');

$promise->then(function ($response) {
    print_r($response->json());
});

$promise->wait();  // Wait for the request to finish
```

#### **Multipart Form Data for File Uploads**

Uploading files is made easy with FetchPHP’s support for multipart form data:

```php
$response = fetch('https://example.com/upload', [
    'method' => 'POST',
    'multipart' => [
        [
            'name' => 'file',
            'contents' => fopen('/path/to/file.jpg', 'r'),
            'filename' => 'file.jpg'
        ]
    ]
]);

echo $response->statusText();  // Outputs the HTTP status text
```

### 🔧 Under the Hood

FetchPHP leverages **Guzzle** under the hood, one of the most powerful and flexible HTTP clients for PHP. This means you get all the benefits of Guzzle (performance, reliability, rich feature set) with a simpler and more intuitive API inspired by JavaScript’s `fetch`.

### ⭐️ Support the Project

I’m really excited to share this project with the PHP community, and I’d love your support! Head over to [GitHub](https://github.com/yourusername/fetchphp), give the project a ⭐️, and share your feedback. Whether it’s bug reports, feature requests, or pull requests, all contributions are welcome! 😊

### 📢 Conclusion

FetchPHP aims to make HTTP requests in PHP as easy and familiar as JavaScript’s `fetch`. It’s simple to use, yet powerful enough for any PHP application. I hope it saves you time and effort in your projects. Thanks for checking it out!

---

### 🔗 Useful Links
- **GitHub**: [GitHub Repository](https://github.com/Thavarshan/fetch-php)
- **Packagist**: [FetchPHP on Packagist](https://packagist.org/packages/jerome/fetch-php)

Thanks for reading, and happy coding! 🎉
