# **Composably ✨**

Transforms your content (markdown, yaml, json etc.)
into validated renderable data at build time.

## **1. Setup**
Create a new SvelteKit (^2.20.0) project or use an existing, then install composably:

```bash
npm install composably
```

In your vite.config.ts, add composably() and pass a config with the locations
for your content and components. Replace sveltekit if it exists.

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
// import { sveltekit } from '@sveltejs/kit/vite'; // Remove this
import { composably } from 'composably/vite'; // Import this

const config = {
  componentRoot: 'src/components',
  contentRoot: 'src/content',
  //optional
  remarkPlugins: [],
  rehypePlugins: [],
};

export default config;


export default defineConfig({
  plugins: [
    // sveltekit() // Replace this...
    composably(config) // ...with this!
  ]
});
```

The plugin exposes a pre-built virtual module `composably:content` with all
content in contentRoot:

```typescript
// src/routes/your-ssg/[...path]/+page.ts
import content from 'composably:content';
const page = await content(path);

// src/routes/your-ssg/[...path]/+page.svelte
<page.component {...page} />
```

## **2. Your First Page (Markdown + Component)**

Create index.md in contentRoot:

```markdown
---
component: Page # This will be replaced by the Page.svelte component
title: Hello Composably!
---

Welcome to your first **Composable** page!
Write standard Markdown here, it will be available as
`body` along with the frontmatter.

## Features

- The headings is extracted for a TOC
- Components can be inserted in the document using ::slots
- Frontmatter can be interpolated with double braces {{title}}
- Emojis, definition lists, extended tables and more...

```

Create a component Page.svelte in componentRoot:

```html
<script module>
  import { c } from 'composably/schemas'; // Schema helpers

  export const schema = c.content({
    title: c.string(), // Expect a string title
    body: c.markdown() // Markdown will be automatically processed
  });
</script>

<script>
  // Props are validated against the schema above!
  // Note: 'body' includes processed content AND metadata like headings
  let { title, body } = $props();
</script>

<h1>{title}</h1>

{#if body.headings && body.headings.length > 0}
  <nav>
    <strong>On this page:</strong>
    <ul>
      {#each body.headings as heading}
        <li><a href="#{heading.id}">{heading.text}</a></li>
      {/each}
    </ul>
  </nav>
{/if}

<body.component {...body} />
```

Load in src/routes/+page.ts:

```typescript
import content from 'composably:content';

export const load = async ({ params }) => {
  return await content(params.path);
};
```

Render in src/routes/+page.svelte:

```html
<script>
  let { page } = $props();
</script>

<page.component {...page} />
```

Boom! Validated, pre-loaded content from Markdown.

## **3. Structured Data (YAML Power)**

Need structured lists, like features? Use YAML!

Create content/features.yaml:

```
component: FeatureList
title: Awesome Features
features:
  - name: Type-Safe Content
    description: Catch errors at build time, not runtime!
  - name: Component-Driven
    description: Map content directly to Svelte components.
  - name: Flexible Formats
    description: Use Markdown OR YAML based on your needs.
```

Create src/components/FeatureList.svelte:

```
<script module>
  import { c } from 'composably/schemas';

  export const schema = c.content({
    title: c.string(),
    features: c.array(c.object({
      name: c.string(),
      description: c.string()
    }))
  });
</script>

<script>
  let { title, features } = $props();
</script>

<h2>{title}</h2>
<ul>
  {#each features as feature}
    <li><strong>{feature.name}:</strong> {feature.description}</li>
  {/each}
</ul>
```

Load it: `const features = await content('features')`;

## **4. Reusable Content (Fragments - DRY!)**

Define common content once, reuse everywhere.

Create content/_author-jane.yaml (leading _ ignored in route discovery):

```
component: AuthorBio
name: Jane Doe
bio: Expert writer exploring Composably.
```

Create src/components/AuthorBio.svelte:

```
<script module>
  import { c } from 'composably/schemas';
  export const schema = c.content({ name: c.string(), bio: c.string() });
</script>
<script> let { name, bio } = $props(); </script>
<span><strong>{name}</strong> ({bio})</span>
```

Reference it in content/blog/my-post.md:

```
---
component: BlogPost
title: My Awesome Post
author: _author-jane.yaml # <-- Reference the fragment!
---
Blog content here...
```

src/components/BlogPost.svelte` schema expects it:

```svelte
<script module>
  import { c } from 'composably/schemas';
  export const schema = c.content({
    title: c.string(),
    // Validate the linked fragment data against AuthorBio's schema!
    author: c.component(['AuthorBio']),
    body: c.markdown()
  });
</script>

<script>
  let { title, author, body } = $props();
</script>

<article>
  <h1>{title}</h1>
  <p>By <author.component {...author} /></p>
  <body.component {...body} />
</article>
```

## **5. Embedding Components**

Need a carousel or alert _inside_ your Markdown flow? Use slots!

Define slot data in content/another-post.md:

```
---
component: Page
title: Embedding with Slots
slots:
  carousel: # Slot name
    component: Swiper # Component for the slot
    slides: # Props for the Swiper component
      - image: /img1.jpg
      - image: /img2.jpg
---

Here is some introductory text.

Now, right here, I want my image carousel:

::carousel

And the text continues after the embedded component. How cool is that?
```

Ensure src/components/Page.svelte schema includes slots:

```
// <script module> in Page.svelte
import { c } from 'composably/schemas';
export const schema = c.content({
  title: c.string(),
  body: c.markdown(), // Processes ::carousel using 'slots' data
  slots: c.slots()
});
// ... rest of Page.svelte ...
```

Create src/components/Swiper.svelte with its schema (slides: c.array(...)). Composably's c.markdown processor magically replaces ::carousel with the rendered Swiper component!

## **6. Built-in Power & Extensibility**

Composably comes with the following features out-of-the-box:

- **Markdown Processing:** Includes standard Markdown, GitHub Flavored Markdown, and syntax highlighting for code blocks.
- **Heading Extraction:** As seen in step 2, the body.headings prop on your c.markdown() field gives you structured access to all h1-h6 tags (text, id, depth) – perfect for auto-generating Tables of Contents!
- **Plugin Ecosystem:** Need more? Composably integrates with the **Remark** (Markdown AST) and **Rehype** (HTML AST) plugin ecosystems. Add plugins to:
  - Automatically add CSS classes (e.g., integrate with Tailwind or DaisyUI).
  - Optimize images.
  - Add custom containers or directives.
  - Generate SEO tags.
  - _...and more!_

## Contribution and disclaimer

**⚠️ Early Alpha - Use with Caution! ⚠️**

This package is currently in the **early alpha stage** of development. While functional for its core purpose, APIs might change, bugs are likely present, and it has not yet been battle-tested in diverse production environments. **Please do not rely on this for critical applications yet.**

Testers and contributors are warmly welcome! Your feedback, bug reports, and code contributions are highly valuable at this stage.

*(Note: The `/dist` directory is currently included in the repository to allow direct installation from GitHub via `npm install kompismoln/composably`. This may change as the project matures towards a stable release.)*

## Getting Started with Development

Follow these steps to set up the project locally for development or testing:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/kompismoln/composably
    cd composably
    ```
2.  **Install dependencies:**
    ```bash
    # Using npm
    npm install

    # Or using pnpm
    # pnpm install

    # Or using yarn
    # yarn install
    ```
3.  **Start the development server:**
    > 💡 Set `DEBUG=composably*` for verbose logging during `npm run dev`, `npm run test`, or `npm run build`.


    This runs the example site included in the repository, using the local version of the plugin.

    ```bash
    npm run dev
    ```
4.  **Run tests:**
    ```bash
    npm run test      # Runs unit tests once
    npm run test:unit # Runs unit tests in watch mode
    ```
5.  **Check code quality:**
    Ensure your changes meet the project's standards before committing.
    ```bash
    npm run format    # Formats code using Prettier
    npm run lint      # Lints code using ESLint
    npm run check     # Runs svelte-check for type checking
    ```
6.  **Build the package:**
    This compiles the plugin code into the `/dist` directory.
    ```bash
    npm run build
    ```

### Using Nix (Optional)

If you use Nix, you can enter a reproducible development shell with all required dependencies activated:
```bash
nix develop
