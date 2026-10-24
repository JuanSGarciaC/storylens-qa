class NotFoundError(Exception):
    """El recurso pedido no existe (o no es visible para quien lo pide)."""


class NotAuthenticatedError(Exception):
    """La acción exige iniciar sesión."""


class ForbiddenError(Exception):
    """La acción no está permitida sobre este recurso."""
