---
title: "FetchPHP 2.0: An Update To Bring Javascript's Fetch & True Async To PHP (Now With Superpowers!)"
description: "I am thrilled to announce the release of FetchPHP 2.0! This new version is crafted to simplify HTTP requests in PHP, enhancing your development experience with greater ease and efficiency. If you have ever faced challenges with asynchronous operations in PHP, FetchPHP 2.0 is the perfect solution for you."
---

# FetchPHP 2.0: An Update To Bring Javascript's Fetch & True Async To PHP (Now With Superpowers!)

## The Journey: From FetchPHP to a More Powerful Version

The inception of FetchPHP stemmed from a straightforward observation: PHP developers deserve the same ease of use that JavaScript developers enjoy with fetch. FetchPHP was created to bring the simplicity of JavaScript’s HTTP handling to the PHP ecosystem. But innovation didn't stop at version 1.0. With the release of FetchPHP 2.0, we've taken it a step further. This version not only simplifies the use of HTTP clients but also complements PHP's native asynchronous functionality ([PHP Fibers](https://www.php.net/manual/en/language.fibers.php)), providing a tool that truly transforms the way you handle HTTP requests in PHP.

## What’s New in FetchPHP 2.0?

FetchPHP 2.0 is packed with powerful features aimed at enhancing both simplicity and performance:

1. **True Asynchronous Execution**: FetchPHP 2.0 introduces true non-blocking asynchronous operations by utilizing PHP Fibers, thanks to the Matrix package. This advancement provides concurrency in PHP like never before, making your applications faster and more efficient.

2. **JavaScript-Like Syntax**: Developers coming from a JavaScript background will find FetchPHP’s new `async`/`await`-like syntax very familiar, allowing for seamless transitions between languages.

3. **Fluent API**: Inspired by Laravel’s HTTP client, FetchPHP’s fluent API allows you to build and chain HTTP requests effortlessly, ensuring clarity and simplicity in even the most complex operations.

4. **Enhanced Error Handling**: FetchPHP 2.0 provides customizable error management through an improved `ErrorHandler`. Whether you need to retry, pause, resume, or cancel requests, the control is entirely in your hands.

5. **Synchronous Requests with Guzzle**: While FetchPHP’s asynchronous capabilities are powered by Matrix, synchronous requests are managed with the reliable Guzzle HTTP client, ensuring robust performance across all request types.

## Advanced Features for Modern Development

FetchPHP 2.0 is designed to handle more complex scenarios without compromising on simplicity. Consider this example:

```php
async(fn () => fetch()
    ->baseUri('https://api.example.com')
    ->withHeaders(['X-API-Key' => 'your-key'])
    ->withBody(json_encode(['data' => 'value']))
    ->withProxy('tcp://localhost:8080')
    ->timeout(5)
    ->retry(3, 1000)
    ->post('/endpoint'))
    ->then(fn ($response) => handleResponse($response->json()))
    ->catch(fn ($e) => logError($e));
```

This demonstrates the power of FetchPHP 2.0 to handle asynchronous requests, proxies, retries, timeouts, and more—all while maintaining clean, readable code.

## Why Choose FetchPHP Over Guzzle?

Let’s compare FetchPHP 2.0 with Guzzle to see how FetchPHP brings unique advantages to PHP developers:

- **Asynchronous Execution**: Guzzle uses promises for async operations, while FetchPHP takes advantage of PHP Fibers, providing true non-blocking concurrency.
- **Familiar Syntax**: FetchPHP offers a JavaScript-like syntax, making it intuitive for developers who are familiar with modern JavaScript or who prefer a streamlined, less verbose approach.
- **Advanced Error Handling**: FetchPHP’s `ErrorHandler` offers flexible control over error states, allowing developers to manage requests dynamically.
- **Ease of Use**: FetchPHP’s fluent API simplifies complex HTTP operations, providing a more natural and elegant way to structure requests.

## A Practical Example: Guzzle vs. FetchPHP

```php
// Guzzle example
$promise = $client->requestAsync('GET', 'http://httpbin.org/get');
$promise->then(function ($response) {
        echo 'Request completed: ' . $response->getBody();
    });

// FetchPHP example
async(fn () => fetch('http://httpbin.org/get'))
    ->then(fn ($response) => echo 'Request completed: ' . $response->body())
    ->catch(fn ($e) => echo 'Request failed: ' . $e->getMessage());
```

FetchPHP not only reduces boilerplate code but also introduces a more natural way of handling asynchronous operations in PHP.

## FetchPHP 2.0: A New Era of PHP HTTP Requests

FetchPHP 2.0 is a powerful, flexible, and intuitive tool that simplifies the process of handling HTTP requests in PHP. Whether you are building small APIs or managing large-scale systems that require thousands of concurrent requests, FetchPHP has the capabilities to enhance your project.

Head over to our [GitHub repository](https://github.com/Thavarshan/fetch-php) to explore FetchPHP, contribute to the project, and don't forget to give us a star on the repository to show your support. Let’s move the PHP ecosystem forward, one asynchronous request at a time.

With FetchPHP 2.0, we’re not just improving how you make HTTP requests in PHP—we’re redefining it. Take control of your HTTP operations with true asynchronous capabilities, a developer-friendly API, and powerful error handling. This is more than an update. It’s a revolution.

Explore the future of PHP HTTP requests with FetchPHP 2.0.
