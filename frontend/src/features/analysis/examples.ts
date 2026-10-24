export interface StoryExample {
  id: string;
  label: string;
  title: string;
  description: string;
  criteria: string;
}

/** Historias de ejemplo para probar la herramienta sin escribir nada. */
export const EXAMPLES: StoryExample[] = [
  {
    id: "weak",
    label: "Ejemplo con problemas",
    title: "Gestionar usuarios",
    description:
      "El sistema debe permitir gestionar usuarios de forma rápida y fácil, con una interfaz amigable y etc.",
    criteria: [
      "La pantalla es amigable",
      "Debe funcionar correctamente en todos los casos",
    ].join("\n"),
  },
  {
    id: "good",
    label: "Ejemplo bien escrito",
    title: "Retirar efectivo",
    description:
      "Como cliente del banco quiero retirar efectivo de un cajero para disponer de mi dinero sin ir a una sucursal",
    criteria: [
      "Dado un saldo de 500 y un retiro de 100, cuando confirmo, entonces el saldo queda en 400",
      "Dado un retiro mayor al saldo, cuando confirmo, entonces veo el mensaje 'Saldo insuficiente' y el saldo no cambia",
      "Dado un monto fuera del rango de 20 a 300 por operación, cuando confirmo, entonces veo un error de límites",
    ].join("\n"),
  },
];
