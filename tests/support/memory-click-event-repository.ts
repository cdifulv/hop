import type {
  ClickEventRecord,
  ClickEventRepository,
  CreateClickEventInput,
} from "../../server/links/click-recorder"

export function createMemoryClickEventRepository(
  seeds: CreateClickEventInput[] = [],
): ClickEventRepository {
  const events: ClickEventRecord[] = []

  async function insert(input: CreateClickEventInput) {
    const event: ClickEventRecord = {
      id: `click-${events.length + 1}`,
      ...input,
    }

    events.push(event)
    return event
  }

  seeds.forEach((seed) => {
    void insert(seed)
  })

  return {
    insert,
    async countForLink(linkId) {
      return events.filter((event) => event.linkId === linkId).length
    },
    async prune(before) {
      const originalCount = events.length
      const retained = events.filter((event) => event.occurredAt >= before)

      events.splice(0, events.length, ...retained)

      return originalCount - retained.length
    },
  }
}
