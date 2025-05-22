ok

now

let's look at @rightmove.server.ts @searchRightmove.server.ts 

we gotta overhaul it to make it a simpler architecture

so.. look at the rightmove types from their api

we gotta have db values for everything, e.g. @RightmoveListProperty.ts  refers to @RightmoveCustomer.ts 

so customer needs to be its own table in @schema.ts 

tables should be named e.g. customerTable, and so on

can scrap the existing property table and we can have a better table that's based from @RightmoveDetailedProperty  - and that should be the full and only rightmove property type, no need to extend from rightmovelistproperty which extends map property etc


