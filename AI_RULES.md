# AI Development Rules

This document outlines the technical stack and development conventions for this project. Following these rules ensures consistency, maintainability, and adherence to the project's architectural standards.

## Tech Stack

The application is built with a modern, component-based architecture. Key technologies include:

- **Framework**: React with TypeScript for building a type-safe user interface.
- **Build Tool**: Vite for fast and efficient development and bundling.
- **UI Components**: **shadcn/ui** is the primary component library, providing a set of accessible and customizable components.
- **Styling**: **Tailwind CSS** is used exclusively for styling. All styles are applied via utility classes.
- **Routing**: **React Router** handles all client-side routing and navigation.
- **Icons**: **Lucide React** provides a comprehensive and consistent set of icons.
- **Data Fetching & State**: **TanStack Query** is used for managing server state, including caching, refetching, and mutations.
- **Data Visualization**: **D3.js** is used for the interactive knowledge graph, and **Recharts** is used for simpler, static charts.
- **Notifications**: **Sonner** is used for displaying toast notifications to the user.
- **Theming**: **next-themes** manages the application's light, dark, and custom color themes.

## Library Usage Guidelines

To maintain a clean and predictable codebase, please adhere to the following rules when choosing libraries for specific tasks:

- **UI Components**:
  - **ALWAYS** use components from the pre-built `shadcn/ui` library located in `src/components/ui`.
  - **DO NOT** introduce new, third-party component libraries (e.g., Material-UI, Ant Design).
  - Create new, custom components in `src/components` by composing `shadcn/ui` components.

- **Styling**:
  - **ALWAYS** use Tailwind CSS utility classes for styling.
  - **AVOID** writing custom CSS in `.css` files. Use global styles in `src/globals.css` only for base theme configuration.
  - Use the `cn` utility from `src/lib/utils.ts` to conditionally apply classes.

- **Icons**:
  - **ONLY** use icons from the `lucide-react` package. This ensures visual consistency.

- **Routing**:
  - All page routes **MUST** be defined within the `<Routes>` component in `src/App.tsx`.
  - Page components should be located in the `src/pages` directory.

- **State Management**:
  - For global UI state that is shared across many components (e.g., the current workspace), use the React Context API. See `src/context/WorkspaceContext.tsx` for an example.
  - For all server state (data fetching, caching, mutations), **ALWAYS** use TanStack Query.

- **API Communication**:
  - All functions that interact with the backend API **MUST** be located in `src/database/workspaceStorage.ts`.
  - **DO NOT** use `fetch` or other HTTP clients directly within components. Call the functions from `workspaceStorage.ts` instead.

- **Notifications**:
  - To display toast notifications, **ALWAYS** use the helper functions (`showSuccess`, `showError`, etc.) from `src/utils/toast.ts`, which are wrappers around the `sonner` library.

- **Data Visualization**:
  - For the main interactive knowledge graph, use **D3.js**.
  - For simpler, non-interactive charts (e.g., pie charts, bar charts), use **Recharts**.