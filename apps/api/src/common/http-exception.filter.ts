import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<{ status: (code: number) => { send: (body: unknown) => void } }>();
    const request = ctx.getRequest<{ url: string }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      reply.status(status).send({
        error: typeof body === "string" ? { message: body } : body,
        path: request.url,
      });
      return;
    }

    this.logger.error(exception);
    const fallback = exception instanceof Error ? exception.message : "Kesalahan server";
    reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: { message: fallback.includes("empty") ? "Permintaan tidak lengkap. Muat ulang halaman, lalu coba lagi." : "Kesalahan server", code: "INTERNAL" },
      path: request.url,
    });
  }
}
