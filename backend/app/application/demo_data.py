"""Historias ficticias del proyecto de demostración. Ningún dato es real."""

from dataclasses import dataclass


@dataclass(frozen=True)
class DemoStory:
    title: str
    description: str
    criteria: tuple[str, ...]
    epic: str
    version: str
    notes: str = ""


DEMO_PROJECT_NAME = "Demo — Plataforma de pagos"
DEMO_PROJECT_DESCRIPTION = (
    "Proyecto ficticio de solo lectura para explorar StoryLens QA. "
    "Contiene historias de calidad variada, con análisis hechos por el motor de reglas."
)
DEMO_PROJECT_OBJECTIVE = "Mostrar cómo se detectan problemas en requisitos antes de probar."
DEMO_EPICS = ("Autenticación", "Pagos")
DEMO_VERSIONS = ("v2.2", "v2.3")

DEMO_STORIES: tuple[DemoStory, ...] = (
    DemoStory(
        title="Recuperar contraseña",
        description=(
            "Como usuario registrado quiero restablecer mi contraseña "
            "para recuperar el acceso a mi cuenta"
        ),
        criteria=(
            "Dado un correo registrado, cuando solicito restablecer, "
            "entonces recibo un enlace que expira en 30 minutos",
            "Dado un enlace expirado, cuando intento usarlo, "
            "entonces veo el mensaje 'El enlace expiró'",
            "Dado una contraseña nueva de 8 a 64 caracteres, cuando la confirmo, "
            "entonces puedo iniciar sesión",
        ),
        epic="Autenticación",
        version="v2.3",
    ),
    DemoStory(
        title="Pago con tarjeta",
        description="El sistema permite pagar con tarjeta de forma rápida y fácil.",
        criteria=(),
        epic="Pagos",
        version="v2.3",
        notes="Falta definir el rol, el beneficio y los criterios de aceptación.",
    ),
    DemoStory(
        title="Iniciar sesión con correo",
        description=(
            "Como cliente quiero iniciar sesión con mi correo y contraseña "
            "para consultar mis movimientos"
        ),
        criteria=(
            "Dado un correo y contraseña válidos, cuando inicio sesión, "
            "entonces veo mi panel en menos de 2 segundos",
            "Dado una contraseña incorrecta, cuando intento entrar 5 veces, "
            "entonces la cuenta se bloquea durante 15 minutos",
        ),
        epic="Autenticación",
        version="v2.2",
    ),
    DemoStory(
        title="Exportar recibo",
        description=(
            "Como cliente quiero descargar el recibo de un pago en PDF "
            "para presentarlo como comprobante"
        ),
        criteria=(
            "Dado un pago aprobado, cuando pulso Descargar recibo, "
            "entonces obtengo un PDF con monto, fecha y número de operación",
            "Dado un pago rechazado, cuando abro su detalle, "
            "entonces no se ofrece la descarga del recibo",
        ),
        epic="Pagos",
        version="v2.2",
    ),
    DemoStory(
        title="Notificaciones de pago",
        description=(
            "Como cliente quiero recibir notificaciones adecuadas, normalmente por correo "
            "y/o SMS, para estar informado"
        ),
        criteria=("El sistema notifica lo antes posible",),
        epic="Pagos",
        version="v2.3",
    ),
    DemoStory(
        title="Cambiar límite diario",
        description=(
            "Como cliente quiero cambiar mi límite diario de transferencias "
            "para controlar mis gastos"
        ),
        criteria=(
            "Dado un límite entre 100 y 5000, cuando lo guardo, "
            "entonces se aplica desde el día siguiente",
            "Dado un límite mayor que 5000, cuando intento guardarlo, "
            "entonces veo el mensaje 'El máximo permitido es 5000'",
        ),
        epic="Pagos",
        version="v2.3",
    ),
    DemoStory(
        title="Cerrar sesión en todos los dispositivos",
        description="Como usuario quiero cerrar sesión en todos mis dispositivos.",
        criteria=("Se cierran las sesiones abiertas",),
        epic="Autenticación",
        version="v2.2",
    ),
    DemoStory(
        title="Reembolso parcial",
        description=(
            "Como comercio quiero devolver una parte de un pago "
            "para resolver reclamos sin anular la venta completa"
        ),
        criteria=(
            "Dado un pago aprobado de 100, cuando reembolso 40, "
            "entonces el cliente recibe 40 y el pago queda con saldo de 60",
            "Dado un reembolso mayor que el pago, cuando lo intento, "
            "entonces veo el mensaje 'El monto excede el pago'",
            "Dado un pago de hace más de 90 días, cuando intento reembolsar, "
            "entonces el sistema lo rechaza",
        ),
        epic="Pagos",
        version="v2.2",
    ),
)
