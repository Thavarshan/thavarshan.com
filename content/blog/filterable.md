---
title: "Filterable: Simplify Data Handling in Your Laravel Applications"
description: "Efficient data management is pivotal in web development, shaping the user experience fundamentally. [Filterable] is a PHP package that empowers developers with sophisticated filtering capabilities, thereby enhancing data interaction within Laravel applications."
published_at: Apr 21, 2024
---

# Filterable: Simplify Data Handling in Your Laravel Applications

## What is Filterable?

Filterable is an open-source PHP package available on GitHub. It is crafted to augment Laravel applications by enabling advanced, dynamic data filtering mechanisms. This package simplifies the complexities involved in handling extensive datasets, thereby facilitating a more streamlined and intuitive interaction with data.

## Core Features

The core features of Filterable make it a highly robust and flexible tool:
- **Dynamic Filtering**: Implement filters dynamically based on user requests.
- **Caching**: Boost application performance by caching filter results, reducing load times significantly.
- **User-Specific Filtering**: Tailor filter logic to individual users, enhancing personalized data interactions.
- **Custom Filter Methods**: Extend the core functionality by adding bespoke filter methods to suit unique application needs.
- **Ease of Integration**: Automatically integrates with Laravel’s service container via package auto-discovery, simplifying setup.
- **Performance Optimization**: Designed to handle large datasets with optimal efficiency.

## Installation and Usage

Installing Filterable is straightforward and can be done using Composer:

```bash
composer require jerome/filterable
```

For Laravel versions that support auto-discovery, no further setup is needed. For older versions, manual registration of the `FilterableServiceProvider` is required.

## Enhanced Usage Details

Creating custom filters is simple with the provided Artisan command, which scaffolds a new filter class for modification:

```bash
php artisan make:filter PostFilter
```

This command will generate a new filter class in the `app/Filters` directory. You can then customise this class to add your own filter methods.

These filters are then applied directly to Eloquent models using the `FilterableTrait`, allowing for seamless integration into existing projects.

The `Filter` class is a base class that provides the core functionality for applying filters to Eloquent queries. You can extend this class to create your own filter classes tailored to your specific models. To use the `Filter` class, you first need to extend it to create your own filter class tailored to your specific model. Here's a basic example for a `Post` model:

```php
namespace App\Filters;

use Filterable\Filter;
use Illuminate\Database\Eloquent\Builder;

class PostFilter extends Filter
{
    protected array $filters = ['status', 'category'];

    protected function status(string $value): Builder
    {
        return $this->builder->where('status', $value);
    }

    protected function category(int $value): Builder
    {
        return $this->builder->where('category_id', $value);
    }
}
```

To add a new filter, simply define a new method within your custom filter class. This method should adhere to PHP's **camelCase** naming convention and be named descriptively based on the filter's purpose. Once you've implemented the method, ensure to register its name in the `$filters` array to activate it. Here's how you can do it:

```php
namespace App\Filters;

use Filterable\Filter;

class PostFilter extends Filter
{
    protected array $filters = ['last_published_at'];

    protected function lastPublishedAt(int $value): Builder
    {
        return $this->builder->where('last_published_at', $value);
    }
}
```

In this example, a new filter `lastPublishedAt` is created in the PostFilter class. The filter name `last_published_at` is registered in the `$filters` array.

### Implementing the `Filterable` Trait and `Filterable` Interface

To use the `Filter` class in your Eloquent models, you need to implement the `Filterable` interface and use the `Filterable` trait. Here's an example for a `Post` model:

```php
namespace App\Models;

use Filterable\Interfaces\Filterable as FilterableInterface;
use Filterable\Traits\Filterable as FilterableTrait;
use Illuminate\Database\Eloquent\Model;

class Post extends Model implements FilterableInterface
{
    use FilterableTrait;
}
```

> **Note**: The `Filterable` interface and `Filterable` trait are included in the package and should be used in your models to enable filtering. The `Filterable` interface is optional but recommended for consistency.

### Applying Filters

You can apply filters to your Eloquent queries like so:

```php
use App\Models\Post;

$filter = new PostFilter(request(), cache());
$posts = Post::filter($filter)->get();
```

### Applying Filters in Controllers

You can apply your custom filters in your controller methods like so:

```php
use App\Models\Post;
use App\Filters\PostFilter;
use Illuminate\Http\Request;

class PostController extends Controller
{
    public function index(Request $request, PostFilter $filter)
    {
        $query = Post::filter($filter);

        $posts = $request->has('paginate')
            ? $query->paginate($request->query('per_page', 20))
            : $query->get();

        return response()->json($posts);
    }
}
```

### Using Filters on the Frontend

You can use filters on the frontend by sending a request with query parameters. For example, to filter posts by status, you can send a request like this:

```typescript
const response = await fetch('/posts?status=active');

const data = await response.json();
```

This request will return all posts with the status `active`.

You can also string together all the filters you want to apply. For example, to filter posts by status and category, you can send a request like this:

```typescript
const response = await fetch('/posts?status=active&category_id=2');

const data = await response.json();
```

## Use Cases

**E-commerce Platforms**

In the e-commerce sector, customer satisfaction hinges on the ability to locate and purchase products quickly and efficiently. Filterable can be integrated into e-commerce platforms to allow users to filter products by various attributes such as size, color, price, brand, and ratings. This precise filtering enhances the shopping experience by helping customers find products that meet their specific preferences or needs. For example, a customer looking for outdoor gear can use Filterable to select waterproof products within a specific price range, significantly narrowing down their search and saving time.

**Analytics Dashboards**

Analytics dashboards require robust data manipulation tools to sift through vast amounts of data and derive meaningful insights. Filterable can be used to create dynamic dashboards where data can be segmented and analyzed based on different criteria such as time periods, demographics, user engagement, or sales metrics. For instance, a digital marketing analyst could use Filterable to view campaign performances across different regions and adjust marketing strategies accordingly. By applying custom filters, users can compare data sets in real-time, facilitating quicker decision-making and more targeted analyses.

**Real Estate Portals**

Real estate websites can benefit from Filterable by providing potential buyers or renters with the ability to filter listings according to their desired criteria, such as location, price range, number of bedrooms, property type, and amenities. This capability not only improves the user experience but also increases the likelihood of matching properties with suitable prospects. For example, a user looking for a family home could filter properties that are only in school-friendly neighborhoods, have at least three bedrooms, and include a backyard.

**Healthcare Data Management**

In healthcare, managing patient data effectively is critical. Filterable can assist healthcare professionals by enabling them to filter patient information by various health metrics, treatment progress, demographic data, or appointment histories. This helps in quickly accessing patient records and making informed decisions about treatments or medical interventions. For instance, a physician could filter out patients who are due for annual check-ups or those who have specific conditions requiring follow-up.

**HR and Recruitment Platforms**

Human Resources and recruitment platforms can utilize Filterable to streamline the candidate selection process by filtering applications based on skills, experience, education level, and other relevant criteria. This functionality aids recruiters in identifying the most suitable candidates for a position or project quickly, significantly reducing the time and effort spent on manual sorting. For example, a recruiter looking for a software developer might filter candidates who have specific programming skills and at least five years of experience.

## Comparison With Other Solutions

**Spatie's Laravel Query Builder**

Spatie's Laravel Query Builder is a well-regarded package that allows developers to filter, sort, and include eloquent relations based on a request, providing a fluent interface to build SQL queries from API requests. This makes it an excellent tool for developers who want to adhere closely to RESTful conventions without writing extensive boilerplate code.

**Distinctive Features of Filterable**

1. **User-Specific Filtering**: One of the standout features of Filterable is its ability to implement user-specific filtering. This feature is particularly useful for applications requiring different data views based on user permissions or roles. For instance, in a multi-tenant system where data access needs to be restricted based on the user's role, Filterable allows easy implementation of these restrictions directly within the filter logic. Spatie’s Query Builder, while powerful in generic filtering capabilities, does not natively support user-specific filtering, which might require additional customization by developers.

2. **Caching of Filter Results**: Filterable enhances performance through its support for caching filter results. This is invaluable for applications dealing with large datasets or requiring high responsiveness. By caching the outcomes of filtered queries, Filterable reduces database load and speeds up response times, which is crucial for high-traffic applications. Spatie's Query Builder does not include built-in caching mechanisms, which means developers need to implement their own caching strategies, potentially increasing complexity.

3. **Custom Filter Methods**: Both Filterable and Spatie's Laravel Query Builder allow for custom filters. However, Filterable provides a slightly more structured approach to adding custom filter methods directly within its filter classes. This structured approach can be particularly beneficial for complex applications with specific filtering logic, as it organizes filter logic in a maintainable and scalable manner. Spatie’s package allows for great flexibility but might require more setup for custom filtering scenarios.

4. **Ease of Integration**: Filterable boasts seamless integration with Laravel's service container through package auto-discovery, which simplifies the initial setup process. This feature is especially beneficial for developers who value convention over configuration. While Spatie's Laravel Query Builder also supports package auto-discovery, the ease of setting up and using Filterable with minimal configuration might appeal more to developers looking for simplicity and rapid deployment.

5. **Performance Optimization**: With its emphasis on performance optimization, Filterable is tailored to efficiently handle large volumes of data without degradation in performance. This makes it ideal for enterprise-level applications where efficiency is a priority. Spatie’s Query Builder, while efficient, may require additional optimizations to handle similar scales of data efficiently.

While Spatie's Laravel Query Builder is a robust and versatile tool suitable for many standard use cases, Filterable provides specific advanced features like user-specific filtering and built-in caching, which make it particularly advantageous for developers working on complex or high-performance applications. The choice between the two would depend on the specific requirements of the project and the desired level of control over the filtering capabilities.

## Future Plans

Continual improvements are on the horizon for Filterable, with plans to expand its customization abilities, add support for more frameworks, and enhance documentation. Community contributions are encouraged to further refine and evolve the package.

**Enjoyed this post?** 🌟 Show your support by starring our [GitHub repository](https://github.com/Thavarshan/filterable)! Your star helps us to keep improving and lets more people discover our project. It's just a click away, but it means a lot to us. Thank you for helping our community grow! 🚀
