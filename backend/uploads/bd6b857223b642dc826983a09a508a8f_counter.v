// Simple counter design with 2 levels of hierarchy
// Top level: counter_top
//   - counter (submodule)

module counter (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        enable,
    output reg  [7:0]  count,
    output wire        overflow
);

    // Internal signals
    wire [7:0] next_count;
    reg        overflow_reg;

    assign next_count = count + 8'd1;
    assign overflow = overflow_reg;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            count <= 8'd0;
            overflow_reg <= 1'b0;
        end else if (enable) begin
            count <= next_count;
            overflow_reg <= (count == 8'hFF);
        end
    end

endmodule


module counter_top (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        start,
    output wire [7:0]  count_out,
    output wire        done
);

    // Internal signals
    reg         running;
    wire        counter_overflow;
    wire [7:0]  counter_value;

    // Instantiate counter submodule
    counter u_counter (
        .clk      (clk),
        .rst_n    (rst_n),
        .enable   (running),
        .count    (counter_value),
        .overflow (counter_overflow)
    );

    // Control logic
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            running <= 1'b0;
        end else if (start && !running) begin
            running <= 1'b1;
        end else if (counter_overflow) begin
            running <= 1'b0;
        end
    end

    assign count_out = counter_value;
    assign done = counter_overflow;

endmodule
