import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaService } from './db/prisma.service';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const configService = app.get(ConfigService);
  app.enableCors({
    origin: configService.get<string>('appOrigin'),
  });
  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);
  await app.listen(configService.get<number>('port') ?? 4000);
}
void bootstrap();
