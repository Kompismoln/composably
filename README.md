# Composably ✨

> Static site generation with typed content + dynamic Svelte components at build time.

Composably is a content processing plugin for Vite and SvelteKit.
It extends the build process by discovering, validating, and transforming content
from Markdown, YAML, JSON, or dynamic modules. The processed content is made available
in your application as a virtual module. This is useful for SSG flows similar to
Astro, Hugo, or Jekyll.

The API is currently a bit unpolished, but the library is a showcase of itself and everything
outside `src/lib` is set up as a consumer example.
There is also an integration test `src/tests/composably.spec.svelte.ts` that describes most
of the functionality. Feel free to clone and hack.

Like MDsveX, this package enables content authors to embed components in markdown,
but MDsveX does this by extending the component syntax with a preprocessor to support markdown,
effectively treating markdown documents as components.
In contrast, Composably treats markdown as a data type just like strings, dates, or arbitrary shapes.
This facilitates a data-driven workflow and enforces a stricter separation of code and content
which can be more intuitive for some SSG patterns.

## 1. Install

Create a new SvelteKit project or cwd into an existing project with Svelte 5.
Then install composably:

```bash
pnpm install composably
```

In your `vite.config.ts`, import the plugin and pass a configuration object
specifying the root directories for your content and components.

```typescript
...
import { composably } from 'composably/vite';

const config = {
  componentRoot: 'src/components',
  contentRoot: 'src/content',
};

export default defineConfig({
  plugins: [
    composably(config),
    ...
  ]
});
```

## 2. Basic workflow

Create a content file at `src/content/index.md`. When the content format is a markdown file
with frontmatter, as in this example, the markdown section will be added as `body` next to the
other fields.

```markdown
---
component: MyPageComponent
title: The index page
---

# Hello world

This is `src/content/index.md`, the root of the site.
`title` is available here: {{title}}.
:tada:
```

See `component` in the frontmatter? It's a keyword that tells Composably the content is for
`src/components/MyPageComponent.svelte`. The rest of the properties (`title` and `body`
in this case) are exactly the props expected by the component:

```html
<script module>
  import { c } from 'composably/schemas';

  export const schema = c.content({
    title: c.string(),
    body: c.markdown()
  });
</script>

<script>
  let { title, body } = $props();
</script>

<h1>{title}</h1>
<body.component {...body} />
```

As you can see, `title` is treated like an ordinary string, but `body` has been transformed to a
dynamic component, how is this achieved?

The `markdown()` type in the schema instructs Composably to parse the field's content to html
and make a virtual module from it. This is a consequence of a general procedure that looks like this:

1. Discover all content files in the content root
2. Extract schemas for all referenced components
3. Validate and transform content according to the schema
4. Replace component names with actual components
5. Expose it all in a virtual export called `composably:content`.

This export can be used to map paths to page data in `routes/[...path]/+page.js`[^2]:
[^2]: While placing `[...path]/+page.js` at the root (e.g., `src/routes/`) enables full-site
SSG-like behavior with Composably, you can also scope it to sub-routes
(e.g., `src/routes/blog/[...path]/`) for partial SSG. Furthermore, the `load` function in
`+page.js` isn't restricted to just passing data from `content()`; you're free to add custom
logic to transform or augment this data before it reaches your Svelte components.

```javascript
import content from 'composably:content';

export const load = async ({ params }) => {
  return await content(params.path);
};
```

The content data has a shape that makes it convenient to render, here's a minimal
example of `routes/[...path]/+page.svelte`:

```html
<script>
  let { data } = $props();
</script>

<data.component {...data} />
```

The result:

```html
<h1>The index page</h1>
<h2>Hello world</h2>
<p>
  This is <code>src/content/index.md</code> <code>title</code> is available
  here: The index page.
  <span role="img" aria-label="tada emoji">🎉</span>
</p>
```

This completes the basic workflow, showing how content is defined, processed by Composably,
loaded in a SvelteKit route, and finally rendered by a Svelte component. You can now create
more content files in `src/content/` (e.g., `about.yaml`) and they will be routable
(e.g., at `/about`) by the same mechanism.

## 3. Features

The heart of Composably is the build-time pipeline that analyzes content and inserts virtual modules
while keeping track of file dependencies for Hot Module Replacement.
Features like markdown transformation, validation, slots, fragments, etc., are merely plugins
to this pipeline and can easily be customized for various needs.
Here's a list of the current feature set:

### Interpolation with double braces

Interpolate values from the content file's frontmatter into any field
processed with `c.markdown()`. Composably uses double brace syntax (`{{title}}`) for this
to relieve authors from the inconvenience of escaping single braces in plain text.

```markdown
---
component: ArticlePage
title: Understanding Interpolation
kicker: A Short Guide
author: Jane Doe
---

### {{kicker}}

# {{title}}

_By {{author}}_
```

However, to prevent hard-to-debug circular dependencies and avoid the complexity of interpolating
large Markdown blocks into each other, other fields from the same content source that are also
typed as `c.markdown()` are excluded from this interpolation.

### Components in components

Structure complex pages by nesting components.

```yaml
component: SimplePageLayout
title: Page with Card
card: # This field holds data for a Card component
  component: Card
    heading: Welcome!
    content: This is a card component content.
```

Use the `c.component()` type to expect data for another component.

```html
<script module>
  import { c } from 'composably/schemas';
  export const schema = c.content({
    title: c.string(),
    card: c.component(['Card']) // Expects data for a 'Card' component
  });
</script>

<script>
  let { title, card } = $props();
</script>

<h1>{title}</h1>
<div class="card-container">
  <card.component {...card} />
</div>
```

Calling `c.component()` without arguments will allow any component,
while passing a list of names `c.component(['Name1', 'Name2'])` restricts to specific components.

### Slots

Define embeddable components in your frontmatter using `slots`. Each key under `slots:` defines
a handle for use in Markdown, so `carousel` key below is picked up by `::carousel` markdown directive.
Markdown fields processed with `c.markdown()` (like `body` in the example) will automatically find
these `::` directives and replace them with the rendered slot component.

```markdown
---
component: Page
title: Embedding with Slots
slots:
  carousel:
    component: Carousel
    slides: # Props for the slot
      - image: /img1.jpg
      - image: /img2.jpg
---
Intro text.

::carousel

Text continues...
```

The `c.slots()` type is used to validate the structure of data provided for a slot.
It accepts an optional array of allowed component names, just like `c.component()`.

```typescript
import { c } from 'composably/schemas';
export const schema = c.content({
  title: c.string(),
  body: c.markdown(), // Processes ::carousel using 'slots' data
  slots: c.slots(['Carousel'])
});
```

Create `src/components/Carousel.svelte` with its schema (`slides: c.array(...)`).
Composably's `c.markdown()` processor replaces `::carousel` with the rendered Carousel component.

### Fragments

Reference content fragments in frontmatter by prefixing the data key with an underscore (`_author:`).
The value is the path to the fragment file (`people/_jane.yaml`).
Fragment files (`people/_jane.yaml`) typically also start with `_` to prevent direct routing.

```yaml
# src/content/people/_jane.yaml
component: AuthorBio
name: Jane Doe
bio: Expert writer exploring Composably.
```

Reference it in another content file:

```markdown
---
component: BlogPost
title: Jane's post
_author: people/_jane.yaml
---

Jane's blog content here...
```

The component receives the page with all fragments resolved and attached.

```html
<script module>
  import { c } from 'composably/schemas';
  export const schema = c.content({
    title: c.string(),
    author: c.component(['AuthorBio']), // Validate the linked fragment data against AuthorBio schema
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

### Headings & TOC

The headings are decreased one step (`H1` -> `H2`) and extracted for a TOC.
Disable decreasing by passing the option to the markdown type:
`c.markdown({ decreaseHeadings: false })`.

```html
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

### Overriding validator

The default validator can be replaced by setting `config.validator` to a validator function,
if you, for example, prefer to centralize your schemas. Here's the contract:

```typescript
export const myPassthruValidator = async (
  content: SourceComponentContent,
  reportFileDependency: (filePath: string) => void,
  config: Config
): Promise<SourceComponentContent> => {
  return content;
};
```

### Extensibility

Composably's markdown parser includes standard Markdown, GitHub Flavored Markdown, syntax highlighting
for code blocks, heading extractions, definition lists and extended tables. Need more?
Composably integrates with the **Remark** (Markdown AST) and **Rehype** (HTML AST) plugin ecosystems.
Add plugins to:

- Automatically add CSS classes (e.g., integrate with Tailwind or DaisyUI).
- Optimize images.
- Add custom containers or directives.
- Generate SEO tags.
- _...and more!_

## 4. Development

Follow these steps to set up the project locally for development or testing:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/kompismoln/composably
    cd composably
    ```
2.  **Install dependencies:**

    ```bash
    pnpm install
    ```

3.  **Start the development server:**

    > 💡 Set `DEBUG=composably*` for verbose logging during `pnpm run dev`, `pnpm run test`, or `pnpm run build`.

    This runs the example site included in the repository, using the local version of the plugin.

    ```bash
    pnpm run dev
    ```

4.  **Run tests:**
    ```bash
    pnpm run test      # Runs unit tests once
    pnpm run test:unit # Runs unit tests in watch mode
    ```
5.  **Check code quality:**
    ```bash
    pnpm run format    # Formats code using Prettier
    pnpm run lint      # Lints code using ESLint
    pnpm run check     # Runs svelte-check for type checking
    ```
6.  **Build the package:**
    This compiles the plugin code into the `/dist` directory.
    ```bash
    pnpm run build
    ```

### Using Nix (Optional)

If you use Nix, you can enter a reproducible development shell with all required dependencies
activated:

```bash
nix develop
```
