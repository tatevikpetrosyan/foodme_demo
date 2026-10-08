package am.foodme.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
// Own in-memory DB, so the orders placed here don't shift order numbers seen by OrderControllerTest.
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:foodme-customer;DB_CLOSE_DELAY=-1;MODE=PostgreSQL")
class CustomerControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String customerToken() throws Exception {
        String email = "promo-test-" + UUID.randomUUID() + "@example.com";
        String response = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Ann",
                                "email", email,
                                "phoneNumber", "+37491234567",
                                "password", "secret123"
                        ))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("token").asText();
    }

    // Promo codes. Test chef 1: delivery 700 AMD, free delivery above 8,000 AMD.

    private String promoPayload(String code, double subtotal) throws Exception {
        return objectMapper.writeValueAsString(Map.of(
                "code", code,
                "chefId", 1,
                "subtotal", subtotal,
                "deliveryMethod", "DELIVERY"
        ));
    }

    private ResultActions applyPromo(String token, String code, double subtotal) throws Exception {
        return mockMvc.perform(post("/api/customer/promo/apply")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(promoPayload(code, subtotal)));
    }

    @Test
    void applyPromo_validCode_discountsOrderTotalIncludingDelivery() throws Exception {
        // 4,200 subtotal + 700 delivery = 4,900; 10% = 490
        applyPromo(customerToken(), "SAVE10", 4200)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SAVE10"))
                .andExpect(jsonPath("$.status").value("APPLIED"))
                .andExpect(jsonPath("$.percent").value(10))
                .andExpect(jsonPath("$.deliveryPrice").value(700.0))
                .andExpect(jsonPath("$.discount").value(490.0))
                .andExpect(jsonPath("$.total").value(4410.0));
    }

    @Test
    void applyPromo_lowerCaseCode_applied() throws Exception {
        applyPromo(customerToken(), " save10 ", 4200)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SAVE10"))
                .andExpect(jsonPath("$.status").value("APPLIED"));
    }

    @Test
    void applyPromo_belowMinimum_reportsMissingAmount() throws Exception {
        applyPromo(customerToken(), "TREAT15", 4200)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("BELOW_MINIMUM"))
                .andExpect(jsonPath("$.missingAmount").value(3800.0))
                .andExpect(jsonPath("$.discount").value(0.0))
                .andExpect(jsonPath("$.total").value(4900.0));
    }

    @Test
    void applyPromo_expiredCode_notApplied() throws Exception {
        applyPromo(customerToken(), "OLD15", 4200)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EXPIRED"))
                .andExpect(jsonPath("$.discount").value(0.0));
    }

    @Test
    void applyPromo_unknownCode_notFound() throws Exception {
        applyPromo(customerToken(), "NOPE", 4200)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_FOUND"))
                .andExpect(jsonPath("$.discount").value(0.0));
    }

    @Test
    void applyPromo_secondCode_replacesFirst() throws Exception {
        // 8,400 is above the free-delivery threshold, so the total is the subtotal; 15% = 1,260
        applyPromo(customerToken(), "SAVE10", 8400).andExpect(status().isOk());
        applyPromo(customerToken(), "TREAT15", 8400)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("TREAT15"))
                .andExpect(jsonPath("$.deliveryPrice").value(0.0))
                .andExpect(jsonPath("$.discount").value(1260.0))
                .andExpect(jsonPath("$.total").value(7140.0));
    }

    @Test
    void applyPromo_withoutToken_unauthorized() throws Exception {
        mockMvc.perform(post("/api/customer/promo/apply")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(promoPayload("SAVE10", 4200)))
                .andExpect(status().isUnauthorized());
    }
}
