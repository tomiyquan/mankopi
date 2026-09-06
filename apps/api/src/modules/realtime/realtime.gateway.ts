import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import type { Server, Socket } from "socket.io";
import type { JwtPayload } from "../../common/auth.guard";

@WebSocketGateway({ cors: { origin: true, credentials: true }, namespace: "/realtime" })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwt: JwtService) {}

  handleConnection(client: Socket) {
    const token = String(client.handshake.auth?.token ?? client.handshake.query.token ?? "");
    try {
      const user = this.jwt.verify<JwtPayload>(token);
      if (user.tenantId) client.join(`tenant:${user.tenantId}`);
      if (user.branchId) client.join(`branch:${user.branchId}`);
      client.join(`user:${user.id}`);
    } catch {
      this.logger.debug(`socket rejected ${client.id}`);
      client.disconnect();
    }
  }

  emitToTenant(tenantId: string, event: string, payload: unknown) {
    this.server?.to(`tenant:${tenantId}`).emit(event, payload);
  }

  @SubscribeMessage("ping")
  ping(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    client.emit("pong", { at: new Date().toISOString(), body });
  }
}
