---
title: "Type-Safe Form Handling in Laravel + Vue.js with Formlink"
description: "Forms are the backbone of web applications, yet handling them properly can be surprisingly complex. From validation to file uploads, CSRF protection to progress tracking, there's a lot that can go wrong. That's where Formlink comes in - a TypeScript-first form handling library that bridges Laravel and Vue.js applications with elegant simplicity."
published_at: Oct 18, 2024
---

# Type-Safe Form Handling in Laravel + Vue.js with Formlink

## The Problem with Traditional Form Handling

Traditional form handling often involves a lot of boilerplate code. You need to:
- Manually track form state
- Handle validation errors
- Deal with file uploads
- Manage CSRF tokens
- Track submission progress
- Type everything correctly

Let's look at how Formlink solves these challenges with its type-safe approach.

## Getting Started with Formlink

First, install Formlink using your preferred package manager:

```bash
npm install formlink
```

The magic of Formlink lies in its TypeScript integration. Let's start with a simple example:

```typescript
interface ContactForm {
  name: string;
  email: string;
  message: string;
}

const form = useForm<ContactForm>({
  name: '',
  email: '',
  message: ''
});
```

By defining an interface, we get complete type safety throughout our form handling. Try to assign a number to the email field? TypeScript will catch that error before it ever reaches your users.

## The Power of Type-Safe Validation

One of the most powerful features of Formlink is its type-safe validation system. Here's how it works:

```typescript
interface ValidationRule {
    validate: (value: any) => boolean | Promise<boolean>;
    message: string;
}

interface ValidationRules<T extends object> {
    [K in keyof T]?: Array<ValidationRule>;
}
```

This type system ensures that:
1. You can only validate fields that actually exist in your form
2. Validation rules are properly structured
3. Error messages are always present

## Real-World Example

Let's look at a complete example that showcases Formlink's capabilities:

```vue
<template>
  <form @submit.prevent="submit">
    <div>
      <input v-model="form.email" type="email" />
      <span v-if="form.errors.email" class="error">
        {{ form.errors.email }}
      </span>
    </div>

    <div>
      <input type="file" @change="handleFile" />
      <div v-if="form.progress" class="progress">
        {{ form.progress.percentage }}% uploaded
      </div>
    </div>

    <button type="submit" :disabled="form.processing">
      {{ form.processing ? 'Sending...' : 'Send' }}
    </button>
  </form>
</template>
```

## Advanced Features That Make Life Easier

### Progress Tracking
Formlink provides built-in progress tracking for file uploads. No more guessing when your files will finish uploading:

```typescript
form.post('/api/upload', {
  onProgress: (progress) => {
    console.log(`${progress.percentage}% uploaded`);
  }
});
```

### Form Transformation
Need to clean up your data before submission? Formlink's transform method has you covered:

```typescript
form.transform((data) => ({
  ...data,
  email: data.email.trim().toLowerCase()
}));
```

### Reactive Form State
Track your form's state effortlessly with reactive properties:
- `form.processing`: Is the form being submitted?
- `form.progress`: Track upload progress
- `form.errors`: Access validation errors
- `form.isDirty`: Has the form been modified?

## Why Choose Formlink?

1. **Type Safety**: Full TypeScript support means fewer runtime errors and better developer experience
2. **Zero Configuration**: Works out of the box with Laravel
3. **Built-in CSRF Protection**: No need to manually handle CSRF tokens
4. **Progress Tracking**: Real-time file upload progress without extra code
5. **Smart Error Handling**: Automatic Laravel validation error handling
6. **Framework Agnostic**: While optimized for Laravel, it works with any backend

## Performance Considerations

Formlink is designed to be lightweight and efficient. It only includes what you need and nothing more. The TypeScript-first approach means you catch errors at compile time rather than runtime, leading to more reliable applications.

## Final Thoughts

Form handling doesn't have to be complicated. With Formlink, you get a type-safe, feature-rich solution that makes form handling in Laravel + Vue.js applications a breeze. The combination of TypeScript's type safety and Formlink's intuitive API means you can focus on building features rather than fighting with form handling.

Try it out in your next project, and experience the difference that proper type-safe form handling can make. Your future self (and your team) will thank you.

Remember, good form handling is about more than just sending data to the server - it's about providing a smooth, error-free experience for your users while maintaining developer sanity. Formlink helps you achieve both.
