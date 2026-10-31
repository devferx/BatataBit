// Contenido de la página, tipado con las Props de cada componente.
// Los JSON se importan como tipos anchos (string); aquí se estrechan a las uniones de Props.
import type { Props as FeatureCardProps } from "../components/FeatureCard/FeatureCard.astro";
import featuresJson from "./features.json";

export const features = featuresJson as FeatureCardProps[];
import type { Props as PlanCardProps } from "../components/PlanCard/PlanCard.astro";
import plansJson from "./plans.json";

export const plans = plansJson as PlanCardProps[];
