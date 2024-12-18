export class IntegrationEvent {
  public readonly subject: string;
  public readonly data: any;
}

export interface IntegrationEventPublisher {
  publish: (event: IntegrationEvent, $framworkContext?: any) => Promise<void>;
}
