// Kiểu dữ liệu Supabase.
// Bản này viết tay theo đúng định dạng của `supabase gen types`. Sau khi link project,
// chạy `npm run db:types` để sinh lại tự động từ DB thật (ghi đè file này).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Rel<FK extends string, Col extends string, Ref extends string, OneToOne extends boolean = false> = {
  foreignKeyName: FK;
  columns: [Col];
  isOneToOne: OneToOne;
  referencedRelation: Ref;
  referencedColumns: ["id"];
};

/** Insert: cột bắt buộc giữ nguyên, cột có default/nullable thành tùy chọn */
type Table<Row, Optional extends keyof Row, Relationships extends unknown[] = []> = {
  Row: Row;
  Insert: Omit<Row, Optional> & Partial<Pick<Row, Optional>>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      categories: Table<
        {
          id: string;
          name: string;
          slug: string;
          parent_id: string | null;
          description: string | null;
          sort_order: number;
          created_at: string;
        },
        "id" | "parent_id" | "description" | "sort_order" | "created_at",
        [Rel<"categories_parent_id_fkey", "parent_id", "categories">]
      >;
      products: Table<
        {
          id: string;
          name: string;
          slug: string;
          category_id: string | null;
          description: string | null;
          material: string | null;
          dimensions: string | null;
          bulb: string | null;
          extra_specs: Json;
          care_instructions: string | null;
          base_price: number;
          compare_at_price: number | null;
          status: Database["public"]["Enums"]["product_status"];
          is_featured: boolean;
          badge: Database["public"]["Enums"]["product_badge"];
          low_stock_threshold: number | null;
          material_tags: string[];
          color_tags: string[];
          spaces: string[];
          seo_description: string | null;
          created_at: string;
          updated_at: string;
        },
        | "id"
        | "category_id"
        | "description"
        | "material"
        | "dimensions"
        | "bulb"
        | "extra_specs"
        | "care_instructions"
        | "base_price"
        | "compare_at_price"
        | "status"
        | "is_featured"
        | "badge"
        | "low_stock_threshold"
        | "material_tags"
        | "color_tags"
        | "spaces"
        | "seo_description"
        | "created_at"
        | "updated_at",
        [Rel<"products_category_id_fkey", "category_id", "categories">]
      >;
      product_options: Table<
        { id: string; product_id: string; name: string; sort_order: number },
        "id" | "sort_order",
        [Rel<"product_options_product_id_fkey", "product_id", "products">]
      >;
      product_option_values: Table<
        { id: string; option_id: string; value: string; hex: string | null; sort_order: number },
        "id" | "hex" | "sort_order",
        [Rel<"product_option_values_option_id_fkey", "option_id", "product_options">]
      >;
      product_variants: Table<
        {
          id: string;
          product_id: string;
          sku: string;
          price: number;
          stock: number;
          is_active: boolean;
          option_values: Json;
          sort_order: number;
          created_at: string;
        },
        "id" | "stock" | "is_active" | "option_values" | "sort_order" | "created_at",
        [Rel<"product_variants_product_id_fkey", "product_id", "products">]
      >;
      product_images: Table<
        {
          id: string;
          product_id: string;
          storage_path: string;
          sort_order: number;
          is_cover: boolean;
          created_at: string;
        },
        "id" | "sort_order" | "is_cover" | "created_at",
        [Rel<"product_images_product_id_fkey", "product_id", "products">]
      >;
      customers: Table<
        {
          id: string;
          name: string;
          phone: string | null;
          address: string | null;
          channel: Database["public"]["Enums"]["sales_channel"];
          note: string | null;
          created_at: string;
        },
        "id" | "phone" | "address" | "channel" | "note" | "created_at"
      >;
      orders: Table<
        {
          id: string;
          code: string;
          customer_id: string | null;
          channel: Database["public"]["Enums"]["sales_channel"];
          payment: Database["public"]["Enums"]["payment_method"];
          status: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          discount: number;
          shipping_fee: number;
          total: number;
          note: string | null;
          source_quote_id: string | null;
          stock_deducted: boolean;
          created_at: string;
          updated_at: string;
        },
        | "id"
        | "code"
        | "customer_id"
        | "payment"
        | "status"
        | "subtotal"
        | "discount"
        | "shipping_fee"
        | "total"
        | "note"
        | "source_quote_id"
        | "stock_deducted"
        | "created_at"
        | "updated_at",
        [
          Rel<"orders_customer_id_fkey", "customer_id", "customers">,
          Rel<"orders_source_quote_id_fkey", "source_quote_id", "quotes">,
        ]
      >;
      order_items: Table<
        {
          id: string;
          order_id: string;
          variant_id: string | null;
          name_snapshot: string;
          variant_snapshot: string | null;
          unit_price: number;
          qty: number;
          sort_order: number;
        },
        "id" | "variant_id" | "variant_snapshot" | "sort_order",
        [
          Rel<"order_items_order_id_fkey", "order_id", "orders">,
          Rel<"order_items_variant_id_fkey", "variant_id", "product_variants">,
        ]
      >;
      order_events: Table<
        {
          id: string;
          order_id: string;
          status: Database["public"]["Enums"]["order_status"] | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
        },
        "id" | "status" | "note" | "created_by" | "created_at",
        [Rel<"order_events_order_id_fkey", "order_id", "orders">]
      >;
      quotes: Table<
        {
          id: string;
          code: string;
          customer_id: string | null;
          status: Database["public"]["Enums"]["quote_status"];
          channel: Database["public"]["Enums"]["sales_channel"];
          message: string | null;
          terms: string | null;
          discount_percent: number;
          shipping_fee: number;
          subtotal: number;
          total: number;
          valid_until: string | null;
          public_token: string;
          view_count: number;
          sent_at: string | null;
          viewed_at: string | null;
          accepted_at: string | null;
          order_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        },
        | "id"
        | "code"
        | "customer_id"
        | "status"
        | "channel"
        | "message"
        | "terms"
        | "discount_percent"
        | "shipping_fee"
        | "subtotal"
        | "total"
        | "valid_until"
        | "public_token"
        | "view_count"
        | "sent_at"
        | "viewed_at"
        | "accepted_at"
        | "order_id"
        | "created_by"
        | "created_at"
        | "updated_at",
        [
          Rel<"quotes_customer_id_fkey", "customer_id", "customers">,
          Rel<"quotes_order_id_fkey", "order_id", "orders">,
        ]
      >;
      quote_items: Table<
        {
          id: string;
          quote_id: string;
          variant_id: string | null;
          name_snapshot: string;
          variant_snapshot: string | null;
          unit_price: number;
          qty: number;
          sort_order: number;
        },
        "id" | "variant_id" | "variant_snapshot" | "sort_order",
        [
          Rel<"quote_items_quote_id_fkey", "quote_id", "quotes">,
          Rel<"quote_items_variant_id_fkey", "variant_id", "product_variants">,
        ]
      >;
      settings: Table<
        { key: string; value: Json; is_public: boolean; updated_at: string },
        "is_public" | "updated_at"
      >;
      profiles: Table<
        {
          id: string;
          role: Database["public"]["Enums"]["user_role"];
          full_name: string | null;
          created_at: string;
        },
        "role" | "full_name" | "created_at"
      >;
      newsletter_subscribers: Table<{ id: string; email: string; created_at: string }, "id" | "created_at">;
      stock_receipts: Table<
        { id: string; code: string; note: string | null; created_by: string | null; created_at: string },
        "id" | "code" | "note" | "created_by" | "created_at"
      >;
      stock_receipt_items: Table<
        {
          id: string;
          receipt_id: string;
          variant_id: string | null;
          product_id: string | null;
          name_snapshot: string;
          variant_snapshot: string | null;
          sku_snapshot: string;
          qty: number;
          sort_order: number;
        },
        "id" | "variant_id" | "product_id" | "variant_snapshot" | "sort_order",
        [
          Rel<"stock_receipt_items_receipt_id_fkey", "receipt_id", "stock_receipts">,
          Rel<"stock_receipt_items_variant_id_fkey", "variant_id", "product_variants">,
          Rel<"stock_receipt_items_product_id_fkey", "product_id", "products">,
        ]
      >;
      stock_movements: Table<
        {
          id: string;
          variant_id: string | null;
          product_id: string | null;
          name_snapshot: string;
          variant_snapshot: string | null;
          sku_snapshot: string;
          kind: Database["public"]["Enums"]["stock_movement_kind"];
          reason: Database["public"]["Enums"]["stock_adjust_reason"] | null;
          note: string | null;
          delta: number;
          stock_after: number;
          order_id: string | null;
          receipt_id: string | null;
          created_by: string | null;
          created_at: string;
        },
        "id" | "variant_id" | "product_id" | "variant_snapshot" | "reason" | "note" | "order_id" | "receipt_id" | "created_by" | "created_at",
        [
          Rel<"stock_movements_variant_id_fkey", "variant_id", "product_variants">,
          Rel<"stock_movements_product_id_fkey", "product_id", "products">,
          Rel<"stock_movements_order_id_fkey", "order_id", "orders">,
          Rel<"stock_movements_receipt_id_fkey", "receipt_id", "stock_receipts">,
        ]
      >;
    };
    Views: {
      product_sales: {
        Row: { product_id: string | null; sold: number | null };
        Relationships: [Rel<"product_variants_product_id_fkey", "product_id", "products">];
      };
      order_list: {
        Row: {
          id: string | null;
          code: string | null;
          status: Database["public"]["Enums"]["order_status"] | null;
          channel: Database["public"]["Enums"]["sales_channel"] | null;
          payment: Database["public"]["Enums"]["payment_method"] | null;
          subtotal: number | null;
          discount: number | null;
          shipping_fee: number | null;
          total: number | null;
          note: string | null;
          created_at: string | null;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          customer_address: string | null;
          items_summary: string | null;
          first_variant: string | null;
          item_count: number | null;
          first_product_id: string | null;
          search: string | null;
        };
        Relationships: [Rel<"orders_customer_id_fkey", "customer_id", "customers">];
      };
      quote_list: {
        Row: {
          id: string | null;
          code: string | null;
          status: Database["public"]["Enums"]["quote_status"] | null;
          channel: Database["public"]["Enums"]["sales_channel"] | null;
          subtotal: number | null;
          total: number | null;
          valid_until: string | null;
          view_count: number | null;
          sent_at: string | null;
          viewed_at: string | null;
          accepted_at: string | null;
          order_id: string | null;
          created_at: string | null;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          items_summary: string | null;
          search: string | null;
        };
        Relationships: [Rel<"quotes_customer_id_fkey", "customer_id", "customers">];
      };
      customer_list: {
        Row: {
          id: string | null;
          name: string | null;
          phone: string | null;
          address: string | null;
          channel: Database["public"]["Enums"]["sales_channel"] | null;
          note: string | null;
          created_at: string | null;
          order_count: number | null;
          total_spent: number | null;
          last_order_at: string | null;
          quote_count: number | null;
          open_quote_count: number | null;
          search: string | null;
        };
        Relationships: [];
      };
      stock_movement_list: {
        Row: {
          id: string | null;
          variant_id: string | null;
          product_id: string | null;
          name_snapshot: string | null;
          variant_snapshot: string | null;
          sku_snapshot: string | null;
          kind: Database["public"]["Enums"]["stock_movement_kind"] | null;
          reason: Database["public"]["Enums"]["stock_adjust_reason"] | null;
          note: string | null;
          delta: number | null;
          stock_after: number | null;
          order_id: string | null;
          receipt_id: string | null;
          created_by: string | null;
          created_at: string | null;
          product_name: string | null;
          order_code: string | null;
          receipt_code: string | null;
          actor_name: string | null;
          search: string | null;
        };
        Relationships: [];
      };
      stock_receipt_list: {
        Row: {
          id: string | null;
          code: string | null;
          note: string | null;
          created_by: string | null;
          created_at: string | null;
          item_count: number | null;
          total_qty: number | null;
          items_summary: string | null;
          actor_name: string | null;
          search: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      admin_adjust_stock: {
        Args: {
          p_variant_id: string;
          p_delta: number;
          p_reason: Database["public"]["Enums"]["stock_adjust_reason"];
          p_note?: string;
        };
        Returns: number;
      };
      admin_create_stock_receipt: { Args: { p: Json }; Returns: Json };
      admin_quote_to_order: {
        Args: { p_id: string; p_payment?: Database["public"]["Enums"]["payment_method"] };
        Returns: Json;
      };
      admin_save_order: { Args: { p: Json }; Returns: Json };
      admin_save_product: { Args: { p: Json }; Returns: string };
      admin_save_quote: { Args: { p: Json }; Returns: Json };
      admin_set_order_status: {
        Args: { p_ids: string[]; p_status: Database["public"]["Enums"]["order_status"]; p_note?: string };
        Returns: number;
      };
      is_admin: { Args: never; Returns: boolean };
      is_product_active: { Args: { p_product_id: string }; Returns: boolean };
      public_accept_quote: { Args: { p_token: string }; Returns: Json };
      public_view_quote: { Args: { p_token: string }; Returns: undefined };
      variant_label: { Args: { p_variant_id: string }; Returns: string };
      vn_today: { Args: never; Returns: string };
    };
    Enums: {
      product_status: "draft" | "active" | "hidden";
      product_badge: "none" | "bestseller" | "new";
      sales_channel: "zalo" | "messenger" | "showroom";
      payment_method: "cod" | "bank_transfer" | "cash";
      order_status: "pending" | "packing" | "shipping" | "done" | "cancelled" | "returned";
      quote_status: "draft" | "sent" | "viewed" | "accepted" | "ordered" | "expired" | "rejected";
      user_role: "admin" | "staff";
      stock_movement_kind: "initial" | "receipt" | "sale" | "return" | "adjust";
      stock_adjust_reason: "damaged" | "count" | "other";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
