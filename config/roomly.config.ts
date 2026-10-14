export type RoomlyConfig = {
  port: number
  host: string
  maxUsers: number
  trustProxy: boolean
  ice: {
    stun: string[]
    useSelfStun: boolean
    selfHost: string
    selfStunPort: number
    turn: {
      urls: string[]
      username: string
    }
  }
  admin: {
    enabled: boolean
  }
}

export const config: RoomlyConfig = {
  port: 3000,
  host: "0.0.0.0",
  maxUsers: 15,
  trustProxy: false,
  ice: {
    stun: [
      "stun:stun.l.google.com:19302",
      "stun:stun.cloudflare.com:3478",
      "stun:stun.nextcloud.com:443",
      "stun:stun.voip.blackberry.com:3478"
    ],
    useSelfStun: false,
    selfHost: "",
    selfStunPort: 3478,
    turn: {
      urls: [],
      username: "roomly",
    },
  },
  admin: {
    enabled: true,
  },
}
