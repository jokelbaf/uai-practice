import { route } from "@react-router/dev/routes";

export default [route("/", "routes/home.tsx"), route("*", "routes/catch-all.tsx")];
