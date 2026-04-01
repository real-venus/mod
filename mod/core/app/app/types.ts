


  export type ModuleType = {
      name: string
      key: string // address 
      id?: number // module id
      desc?: string // description
      content?: string // CID to the content of the user
      created: number // time of the mod
      updated?: number // time of last update
      schema?: string // the schema of the mod
      url?: string // the url of the server
      url_app?: string // the url of the app
      chain_id?: string // chain id if applicable
      collateral?: number // collateral locked in the mod
      cid?: string // CID of the mod content
      network?: string // network of the mod
      public?: boolean // whether the module is public
      allowed_users?: string[] // list of allowed user keys
      take?: number // take percentage
    }


  export interface ModulesState {
      mods: ModuleType[]
      n: number
      loading: boolean
      error: string | null
    }
    
  export interface UserType {
    key?: string
    crypto_type: string
    wallet_mode?: string
    token?: string
    balance?: number
    mods?: any[]
    network?: string
    user_roles?: any[]
  }



  export interface UsersState {
    users: UserType[]
    n: number
    loading: boolean
    error: string | null
  }
